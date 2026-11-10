#!/bin/sh
# Sube Elemental Warriors al repositorio oficial de Sara (rama main). Necesita Git.
cd "$(dirname "$0")" || exit 1
command -v git >/dev/null || { echo "Falta Git: https://git-scm.com"; exit 1; }
git remote get-url origin >/dev/null 2>&1 || git remote add origin https://github.com/SaraAndrade1123/ElementalWarriors.git
git remote set-url origin https://github.com/SaraAndrade1123/ElementalWarriors.git
# si el repositorio ya tenía archivos (por ejemplo un README creado en GitHub) se combinan con los del juego
if git push -u origin main || { git -c user.name=ElementalWarriors -c user.email=elementalwarriors.therealms1123@gmail.com pull --no-rebase origin main --allow-unrelated-histories --no-edit -X ours && git push -u origin main; }; then
  echo "Listo. Activa Settings > Pages > Source: GitHub Actions en el repositorio."
else
  echo "No se pudo subir: revisa la conexión y que iniciaste sesión con la cuenta de Sara."; exit 1
fi
