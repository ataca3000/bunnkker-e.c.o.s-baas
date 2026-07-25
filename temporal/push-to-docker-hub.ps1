# Script para publicar la imagen en Docker Hub
# Uso: .\push-to-docker-hub.ps1

param(
    [string]$ImageName = "camalion-topics-erp",
    [string]$Version = "latest",
    [string]$DockerHubUser = "terraform98"
)

Write-Host "🐳 Iniciando proceso de publicación en Docker Hub..." -ForegroundColor Cyan

# Step 1: Verificar que la imagen existe
Write-Host "`n📦 Verificando imagen local..." -ForegroundColor Yellow
$images = docker images --filter "reference=$ImageName" --quiet
if (-not $images) {
    Write-Host "❌ Error: Imagen '$ImageName' no encontrada. Compila primero con: docker build -t $ImageName ." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Imagen encontrada" -ForegroundColor Green

# Step 2: Tag la imagen
$FullTag = "$DockerHubUser/$ImageName`:$Version"
Write-Host "`n🏷️  Creando tag: $FullTag" -ForegroundColor Yellow
docker tag "$ImageName`:$Version" "$FullTag"
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error al crear el tag" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Tag creado exitosamente" -ForegroundColor Green

# Step 3: Push a Docker Hub
Write-Host "`n📤 Publicando en Docker Hub (esto puede tomar algunos minutos)..." -ForegroundColor Yellow
docker push "$FullTag"
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error al publicar en Docker Hub" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Publicación completada exitosamente" -ForegroundColor Green

# Step 4: Mostrar información
Write-Host "`n✨ ¡Listo! Tu imagen está disponible en Docker Hub:" -ForegroundColor Green
Write-Host "   📍 $FullTag"
Write-Host "   🌐 https://hub.docker.com/r/$DockerHubUser/$ImageName"
Write-Host "`n💻 Para usar la imagen en cualquier lugar:" -ForegroundColor Cyan
Write-Host "   docker pull $FullTag"
Write-Host "   docker run -p 3000:3000 $FullTag"
