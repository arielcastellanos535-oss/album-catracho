# Album Catracho — instalar dependencias y arrancar (arreglo SSL Windows)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "Configurando npm/pnpm para evitar error de certificado SSL..." -ForegroundColor Cyan
npm config set strict-ssl false
pnpm config set strict-ssl false

Write-Host "Instalando dependencias (puede tardar 2-3 min)..." -ForegroundColor Green
pnpm install
if ($LASTEXITCODE -ne 0) {
  Write-Host "pnpm fallo, probando con npm..." -ForegroundColor Yellow
  npm install
}

Write-Host "Arrancando app en http://localhost:3000 ..." -ForegroundColor Green
pnpm dev
