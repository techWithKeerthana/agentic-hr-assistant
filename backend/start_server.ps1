# Start backend server with .env loaded
$envFile = "C:\Intelligent\agentic-hr-assistant\.env"
Get-Content $envFile | ForEach-Object {
    if ($_ -match "^\s*([^#\s][^=]*)=(.*)$") {
        $key = $matches[1].Trim()
        $val = $matches[2].Trim()
        [System.Environment]::SetEnvironmentVariable($key, $val, "Process")
    }
}
$env:PYTHONPATH = "."
Set-Location "C:\Intelligent\agentic-hr-assistant\backend"
& ".\venv\Scripts\uvicorn.exe" main:app --port 8000 --log-level info
