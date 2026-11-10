@echo off
chcp 65001 >nul
rem Sube Elemental Warriors al repositorio oficial de Sara (rama main). Necesita Git: https://git-scm.com
cd /d "%~dp0"
where git >nul 2>nul || (echo Falta Git. Instalalo desde https://git-scm.com y vuelve a abrir este archivo. & pause & exit /b 1)
git remote get-url origin >nul 2>nul || git remote add origin https://github.com/SaraAndrade1123/ElementalWarriors.git
git remote set-url origin https://github.com/SaraAndrade1123/ElementalWarriors.git
echo Subiendo a https://github.com/SaraAndrade1123/ElementalWarriors ... (inicia sesion con la cuenta de Sara si lo pide)
git push -u origin main
if errorlevel 1 (
  echo El repositorio ya tenia archivos: se combinan con los del juego y se vuelve a intentar...
  git -c user.name=ElementalWarriors -c user.email=elementalwarriors.therealms1123@gmail.com pull --no-rebase origin main --allow-unrelated-histories --no-edit -X ours && git push -u origin main
)
if errorlevel 1 (echo. & echo No se pudo subir: revisa la conexion y que iniciaste sesion con la cuenta de Sara. & pause & exit /b 1)
echo.
echo Listo. Activa Settings ^> Pages ^> Source: GitHub Actions en el repositorio.
pause
