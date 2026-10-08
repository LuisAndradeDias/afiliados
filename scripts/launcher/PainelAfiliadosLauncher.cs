using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Reflection;
using System.Threading;
using System.Windows.Forms;

[assembly: AssemblyTitle("Afiliados - Iniciar Painel")]
[assembly: AssemblyDescription("Inicia o painel local do Afiliados sem abrir servidores duplicados.")]
[assembly: AssemblyCompany("Afiliados")]
[assembly: AssemblyProduct("Afiliados")]
[assembly: AssemblyVersion("1.0.0.0")]

namespace AfiliadosLauncher
{
    internal static class Program
    {
        private const int DefaultPort = 3030;
        private const int WaitSeconds = 50;

        [STAThread]
        private static int Main(string[] args)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            bool noBrowser = false;
            foreach (string arg in args)
            {
                if (string.Equals(arg, "--no-browser", StringComparison.OrdinalIgnoreCase))
                {
                    noBrowser = true;
                }
            }

            try
            {
                string root = Path.GetFullPath(AppDomain.CurrentDomain.BaseDirectory);
                if (!File.Exists(Path.Combine(root, "package.json")))
                {
                    return Fail("O arquivo package.json nao foi encontrado ao lado do executavel.\n\n" +
                                "Coloque o EXE na pasta principal do projeto Afiliados.");
                }

                string script = Path.Combine(root, "scripts", "launcher", "iniciar-painel.cmd");
                if (!File.Exists(script))
                {
                    return Fail("Nao encontrei o script de inicializacao:\n" + script +
                                "\n\nMantenha a pasta scripts junto do executavel.");
                }

                int port = GetPort(Path.Combine(root, ".env"));
                string webUrl = "http://localhost:" + port + "/";
                string mutexName = @"Local\Afiliados-Painel-Launcher-" + port;

                using (Mutex singleton = new Mutex(false, mutexName))
                {
                    bool acquired = false;
                    try
                    {
                        acquired = singleton.WaitOne(0);
                        if (!acquired)
                        {
                            // Outro clique ja iniciou o mesmo executavel.
                            return 0;
                        }

                        if (PanelReady(port))
                        {
                            if (!noBrowser) OpenBrowser(webUrl);
                            return 0;
                        }

                        if (PortOccupied(port))
                        {
                            return Fail("A porta " + port +
                                        " ja esta ocupada por outro programa, mas o painel nao respondeu.\n" +
                                        "Nao iniciei um segundo servidor para evitar conflitos.");
                        }

                        string npm = ResolveNpm();
                        if (npm == null || !Directory.Exists(Path.Combine(root, "node_modules")))
                        {
                            return Fail("O Node.js/npm ou a pasta node_modules nao foi encontrado.\n\n" +
                                        "Instale as dependencias do projeto antes de usar o launcher.");
                        }

                        string logDir = Path.Combine(root, "data", "logs");
                        Directory.CreateDirectory(logDir);

                        ProcessStartInfo startInfo = new ProcessStartInfo();
                        startInfo.FileName = Environment.GetEnvironmentVariable("ComSpec") ?? "cmd.exe";
                        startInfo.Arguments = "/d /c call \"" + script + "\"";
                        startInfo.WorkingDirectory = root;
                        startInfo.UseShellExecute = false;
                        startInfo.CreateNoWindow = true;
                        startInfo.WindowStyle = ProcessWindowStyle.Hidden;

                        // O CMD continua executando o painel mesmo apos o launcher fechar.
                        using (Process process = Process.Start(startInfo))
                        {
                            if (process == null)
                            {
                                return Fail("Nao consegui iniciar o processo do painel.");
                            }

                            if (!WaitForReady(port, process, WaitSeconds))
                            {
                                string log = Path.Combine(logDir, "painel-launcher.log");
                                return Fail("O painel nao ficou disponivel a tempo.\n\n" +
                                            "Verifique os detalhes em:\n" + log);
                            }
                        }

                        if (!noBrowser) OpenBrowser(webUrl);
                        return 0;
                    }
                    finally
                    {
                        if (acquired)
                        {
                            try { singleton.ReleaseMutex(); }
                            catch (ApplicationException) { }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                return Fail("Nao foi possivel iniciar o painel.\n\n" + ex.Message);
            }
        }

        private static int GetPort(string envFile)
        {
            string value = Environment.GetEnvironmentVariable("PAINEL_PORT");
            if (string.IsNullOrWhiteSpace(value) && File.Exists(envFile))
            {
                foreach (string line in File.ReadAllLines(envFile))
                {
                    string trimmed = line.Trim().TrimStart('\uFEFF');
                    if (trimmed.StartsWith("PAINEL_PORT=", StringComparison.OrdinalIgnoreCase))
                    {
                        value = trimmed.Substring("PAINEL_PORT=".Length).Trim();
                        value = value.Trim('"', '\'');
                        break;
                    }
                }
            }

            int port;
            if (int.TryParse(value, out port) && port >= 1024 && port <= 65535)
            {
                return port;
            }
            return DefaultPort;
        }

        private static bool PanelReady(int port)
        {
            HttpWebRequest request = (HttpWebRequest) WebRequest.Create(
                "http://127.0.0.1:" + port + "/api/status");
            request.Proxy = null;
            request.KeepAlive = false;
            request.Timeout = 1600;
            request.ReadWriteTimeout = 1600;

            try
            {
                using (HttpWebResponse response = (HttpWebResponse) request.GetResponse())
                {
                    if (response.StatusCode != HttpStatusCode.OK) return false;
                    if (response.ContentType == null ||
                        !response.ContentType.Contains("application/json")) return false;

                    using (StreamReader reader = new StreamReader(response.GetResponseStream()))
                    {
                        string body = reader.ReadToEnd();
                        return body.IndexOf("\"operacaoEstado\"",
                            StringComparison.OrdinalIgnoreCase) >= 0;
                    }
                }
            }
            catch (WebException) { return false; }
            catch (IOException) { return false; }
        }

        private static bool PortOccupied(int port)
        {
            try
            {
                using (TcpClient client = new TcpClient())
                {
                    IAsyncResult result = client.BeginConnect("127.0.0.1", port, null, null);
                    using (WaitHandle waitHandle = result.AsyncWaitHandle)
                    {
                        if (!waitHandle.WaitOne(300)) return false;
                        client.EndConnect(result);
                        return true;
                    }
                }
            }
            catch (SocketException) { return false; }
            catch (ObjectDisposedException) { return false; }
        }

        private static string ResolveNpm()
        {
            string known = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),
                "nodejs", "npm.cmd");
            if (File.Exists(known)) return known;

            string path = Environment.GetEnvironmentVariable("PATH") ?? "";
            foreach (string part in path.Split(';'))
            {
                string dir = part.Trim().Trim('"');
                if (dir.Length == 0) continue;
                string possible = Path.Combine(dir, "npm.cmd");
                if (File.Exists(possible)) return possible;
            }
            return null;
        }

        private static bool WaitForReady(int port, Process child, int waitSeconds)
        {
            Stopwatch watch = Stopwatch.StartNew();
            while (watch.Elapsed.TotalSeconds < waitSeconds)
            {
                if (PanelReady(port)) return true;
                if (child.HasExited) return PanelReady(port);
                Thread.Sleep(650);
            }
            return PanelReady(port);
        }

        private static void OpenBrowser(string url)
        {
            ProcessStartInfo browser = new ProcessStartInfo();
            browser.FileName = url;
            browser.UseShellExecute = true;
            Process.Start(browser);
        }

        private static int Fail(string message)
        {
            MessageBox.Show(
                message, "Afiliados - Iniciar Painel",
                MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return 1;
        }
    }
}
