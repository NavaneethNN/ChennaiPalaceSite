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

# Discover local IPv4 addresses on this Windows PC
$localIPs = @()
try {
    $allAddrs = [System.Net.Dns]::GetHostAddresses([System.Net.Dns]::GetHostName())
    foreach ($addr in $allAddrs) {
        if ($addr.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork -and $addr.IPAddressToString -notlike "127.*" -and $addr.IPAddressToString -notlike "169.254.*") {
            $localIPs += $addr.IPAddressToString
        }
    }
} catch {}

$isLanMode = $false
try {
    # Attempt to listen on all network interfaces (LAN mode)
    $listener.Prefixes.Add("http://*:$port/")
    $listener.Start()
    $isLanMode = $true
} catch {
    try {
        $listener = New-Object System.Net.HttpListener
        $listener.Prefixes.Add("http://+:$port/")
        $listener.Start()
        $isLanMode = $true
    } catch {
        # Fallback to localhost only
        $listener = New-Object System.Net.HttpListener
        $listener.Prefixes.Add("http://127.0.0.1:$port/")
        $listener.Prefixes.Add("http://localhost:$port/")
        $listener.Start()
        $isLanMode = $false
    }
}

function Get-InstalledPrintersList {
    $results = @()
    try {
        $raw = Get-CimInstance -ClassName Win32_Printer -ErrorAction Stop
        foreach ($p in $raw) {
            if ($p -and $p.Name) {
                $results += @{
                    name = [string]$p.Name
                    is_default = [bool]$p.Default
                    port = if ($p.PortName) { [string]$p.PortName } else { "" }
                }
            }
        }
        return $results
    } catch {}

    try {
        $raw = Get-Printer -ErrorAction Stop
        foreach ($p in $raw) {
            if ($p -and $p.Name) {
                $results += @{
                    name = [string]$p.Name
                    is_default = [bool]($p.Type -eq "Default")
                    port = if ($p.PortName) { [string]$p.PortName } else { "" }
                }
            }
        }
        return $results
    } catch {}

    try {
        $raw = Get-WmiObject -Class Win32_Printer -ErrorAction SilentlyContinue
        foreach ($p in $raw) {
            if ($p -and $p.Name) {
                $results += @{
                    name = [string]$p.Name
                    is_default = [bool]$p.Default
                    port = if ($p.PortName) { [string]$p.PortName } else { "" }
                }
            }
        }
    } catch {}

    return $results
}

try {
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host "  Chennai Palace - Windows Printer Bridge is ACTIVE" -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Green
    if ($isLanMode) {
        Write-Host "  STATUS: Connected to ALL network interfaces (Port $port)" -ForegroundColor Green
        Write-Host ""
        Write-Host "  Local IP address of this Windows PC:" -ForegroundColor Cyan
        foreach ($ip in $localIPs) {
            Write-Host "    -> $ip" -ForegroundColor Yellow
        }
        Write-Host ""
        Write-Host "  HOW TO CONNECT FROM YOUR MAC OR IPAD OVER WI-FI:" -ForegroundColor White
        Write-Host "  1. On your Mac/iPad, open Chennai Palace Admin > Printers." -ForegroundColor Gray
        if ($localIPs.Count -gt 0) {
            Write-Host "  2. Under 'Windows PC IP', enter: $($localIPs[0])" -ForegroundColor Yellow
        } else {
            Write-Host "  2. Under 'Windows PC IP', enter your Windows PC local IP." -ForegroundColor Yellow
        }
        Write-Host "  3. Click 'Scan Windows printers'. Your printers will appear instantly!" -ForegroundColor Gray
    } else {
        Write-Host "  STATUS: Listening on Localhost only (http://127.0.0.1:$port/)" -ForegroundColor Yellow
        Write-Host "  Printers can be scanned when Chennai Palace is opened in Chrome/Edge on this PC." -ForegroundColor Gray
        Write-Host ""
        Write-Host "  Tip: To allow scanning/printing from a Mac or iPad over Wi-Fi:" -ForegroundColor Gray
        Write-Host "  Close this window, right-click windows-printer-bridge.bat and select 'Run as administrator'." -ForegroundColor Gray
    }
    Write-Host ""
    Write-Host "  - GET  /printers : Detects connected Windows printers" -ForegroundColor Gray
    Write-Host "  - POST /print    : Direct instant printing for KOT orders" -ForegroundColor Gray
    Write-Host "  Leave this window open during restaurant service." -ForegroundColor Cyan
    Write-Host "  Press Ctrl+C to close." -ForegroundColor Gray
    Write-Host "==========================================================" -ForegroundColor Green

    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        # Allow Web Browser to communicate with localhost and across LAN (CORS & Private Network Access)
        $response.AddHeader("Access-Control-Allow-Origin", "*")
        $response.AddHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        $response.AddHeader("Access-Control-Allow-Headers", "*")
        $response.AddHeader("Access-Control-Allow-Private-Network", "true")
        $response.AddHeader("Access-Control-Max-Age", "86400")

        if ($request.HttpMethod -eq "OPTIONS") {
            $response.StatusCode = 204
            $response.Close()
            continue
        }

        # Route 1: List installed Windows printers
        if ($request.Url.AbsolutePath -eq "/printers" -and $request.HttpMethod -eq "GET") {
            try {
                $items = Get-InstalledPrintersList
                $json = ConvertTo-Json -InputObject @($items) -Compress
                if ([string]::IsNullOrWhiteSpace($json) -or $json -eq "null") {
                    $json = "[]"
                } elseif (-not $json.StartsWith("[")) {
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

                $requestedPrinter = [string]$payload.printer
                $printText = [string]$payload.text
                $orderId = [string]$payload.orderId
                $dest = [string]$payload.destination

                # Fetch available printers to resolve target
                $allPrintersData = Get-InstalledPrintersList
                $allNames = @()
                foreach ($p in $allPrintersData) {
                    if ($p.name) { $allNames += $p.name }
                }

                $targetPrinter = $null
                if ($requestedPrinter -and $requestedPrinter.Trim()) {
                    $cleanReq = $requestedPrinter.Trim()
                    # Exact match
                    $targetPrinter = $allNames | Where-Object { $_ -eq $cleanReq } | Select-Object -First 1
                    if (-not $targetPrinter) {
                        # Case-insensitive / partial match
                        $targetPrinter = $allNames | Where-Object { $_ -like "*$cleanReq*" } | Select-Object -First 1
                    }
                }

                if (-not $targetPrinter) {
                    # Fallback to Windows default printer
                    $defItem = $allPrintersData | Where-Object { $_.is_default -eq $true } | Select-Object -First 1
                    if ($defItem) {
                        $targetPrinter = $defItem.name
                    }
                }

                if (-not $targetPrinter -and $allNames.Count -gt 0) {
                    $targetPrinter = $allNames[0]
                }

                if (-not $targetPrinter) {
                    throw "No suitable Windows printer found on this system. Please check printer connection."
                }

                # Send text directly to Windows print spooler via Out-Printer
                try {
                    $lines = $printText -split "`r?`n"
                    $lines | Out-Printer -Name $targetPrinter -ErrorAction Stop
                } catch {
                    # Fallback via UTF-8 temp file
                    $tempPath = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "kot-$([System.Guid]::NewGuid().ToString()).txt")
                    [System.IO.File]::WriteAllText($tempPath, $printText, [System.Text.Encoding]::UTF8)
                    Get-Content -Path $tempPath -Raw -Encoding UTF8 | Out-Printer -Name $targetPrinter
                    Remove-Item -Path $tempPath -Force -ErrorAction SilentlyContinue
                }

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
            $statusObj = @{
                status = "ok"
                app = "Chennai Palace Printer Bridge"
                version = "2.1.0"
                lanMode = $isLanMode
                localIPs = $localIPs
                timestamp = (Get-Date).ToString("o")
            }
            $msg = ConvertTo-Json -InputObject $statusObj -Compress
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
