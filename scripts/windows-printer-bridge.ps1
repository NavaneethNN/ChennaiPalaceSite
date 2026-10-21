<#
.SYNOPSIS
  Chennai Palace - Local Windows Printer Discovery & Direct Print Bridge
.DESCRIPTION
  Runs a lightweight HTTP listener on port 18080 on the Windows POS machine.
  1. Auto-detects installed Windows printers for the Admin Web Panel.
  2. Receives direct, continuous print jobs from the Cashier/Admin console
     and dispatches them immediately to the assigned thermal printers (Kitchen & Cashier).
  3. Eliminates browser pop-up blocking and guarantees fast, non-blocking thermal printing.
#>

$port = 18080
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$port/")
$listener.Prefixes.Add("http://localhost:$port/")

try {
    $listener.Start()
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host "  Chennai Palace - Windows Printer Bridge is ACTIVE" -ForegroundColor Green
    Write-Host "  Listening on: http://127.0.0.1:$port/" -ForegroundColor Cyan
    Write-Host "  - GET  /printers : Detects connected Windows printers" -ForegroundColor Gray
    Write-Host "  - POST /print    : Direct instant printing for KOT orders" -ForegroundColor Gray
    Write-Host "  Leave this window open during restaurant service." -ForegroundColor Yellow
    Write-Host "  Press Ctrl+C to close." -ForegroundColor Gray
    Write-Host "==========================================================" -ForegroundColor Green

    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        # Allow Web Browser to communicate with localhost (CORS)
        $response.AddHeader("Access-Control-Allow-Origin", "*")
        $response.AddHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        $response.AddHeader("Access-Control-Allow-Headers", "Content-Type")

        if ($request.HttpMethod -eq "OPTIONS") {
            $response.StatusCode = 204
            $response.Close()
            continue
        }

        # Route 1: List installed Windows printers
        if ($request.Url.AbsolutePath -eq "/printers" -and $request.HttpMethod -eq "GET") {
            try {
                $printers = Get-CimInstance -ClassName Win32_Printer | Select-Object Name, Default, PortName
                $items = @()
                foreach ($p in $printers) {
                    $items += @{
                        name = $p.Name
                        is_default = [bool]$p.Default
                        port = $p.PortName
                    }
                }
                $json = ConvertTo-Json -InputObject $items -Compress
                if (-not $json.StartsWith("[")) {
                    $json = "[$json]"
                }
            } catch {
                $json = "[]"
            }
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($json)
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
        }
        # Route 2: Direct instant print job for continuous KOT orders
        elseif ($request.Url.AbsolutePath -eq "/print" -and $request.HttpMethod -eq "POST") {
            try {
                $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                $body = $reader.ReadToEnd()
                $payload = ConvertFrom-Json $body

                $requestedPrinter = $payload.printer
                $printText = $payload.text
                $orderId = $payload.orderId
                $dest = $payload.destination

                # Fetch available printers to resolve target
                $allPrinters = Get-CimInstance -ClassName Win32_Printer | Select-Object -ExpandProperty Name
                $targetPrinter = $null

                if ($requestedPrinter) {
                    # Exact match
                    $targetPrinter = $allPrinters | Where-Object { $_ -eq $requestedPrinter }
                    if (-not $targetPrinter) {
                        # Case-insensitive or partial match
                        $targetPrinter = $allPrinters | Where-Object { $_ -like "*$requestedPrinter*" } | Select-Object -First 1
                    }
                }

                if (-not $targetPrinter) {
                    # Fallback to Windows default printer
                    $defaultPrn = Get-CimInstance -ClassName Win32_Printer -Filter "Default = True"
                    $targetPrinter = $defaultPrn.Name
                }

                if (-not $targetPrinter) {
                    throw "No suitable Windows printer found on this system."
                }

                # Send text directly to Windows print spooler via Out-Printer
                # Write to UTF-8 temp file first to ensure full character encoding integrity
                $tempPath = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "kot-$([System.Guid]::NewGuid().ToString()).txt")
                [System.IO.File]::WriteAllText($tempPath, $printText, [System.Text.Encoding]::UTF8)
                Get-Content -Path $tempPath -Raw -Encoding UTF8 | Out-Printer -Name $targetPrinter
                Remove-Item -Path $tempPath -Force -ErrorAction SilentlyContinue

                $timeStr = [DateTime]::Now.ToString("HH:mm:ss")
                Write-Host "[$timeStr] PRINT JOB OK: Order #$orderId -> $targetPrinter ($dest)" -ForegroundColor Green

                $respJson = ConvertTo-Json -InputObject @{
                    ok = $true
                    printed = $true
                    printer = $targetPrinter
                    orderId = $orderId
                    destination = $dest
                    timestamp = (Get-Date).ToString("o")
                } -Compress
                $buffer = [System.Text.Encoding]::UTF8.GetBytes($respJson)
                $response.ContentType = "application/json; charset=utf-8"
                $response.ContentLength64 = $buffer.Length
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
            } catch {
                $err = $_.Exception.Message
                Write-Host "[$([DateTime]::Now.ToString('HH:mm:ss'))] PRINT ERROR: $err" -ForegroundColor Red
                $respJson = ConvertTo-Json -InputObject @{
                    ok = $false
                    printed = $false
                    error = $err
                } -Compress
                $buffer = [System.Text.Encoding]::UTF8.GetBytes($respJson)
                $response.StatusCode = 500
                $response.ContentType = "application/json; charset=utf-8"
                $response.ContentLength64 = $buffer.Length
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
            }
        } else {
            $msg = '{"status":"ok","app":"Chennai Palace Printer Bridge v2"}'
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($msg)
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
        }
        $response.Close()
    }
} catch {
    Write-Error $_
} finally {
    $listener.Stop()
}
