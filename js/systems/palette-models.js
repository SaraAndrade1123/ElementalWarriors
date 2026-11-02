// Colores originales de las texturas de cada guerrero, agrupados por "ranura" (parte que se puede recolorear).
// La primera de cada lista es el color principal; el resto son sus sombras/variantes.
// "keep" = colores que NUNCA cambian (piel, cabello, contornos negros). Si cambias de modelo, vuelve a medirlos.
export const PALETTE_MODELS = {
  ignis: {
    slots: {
      coat: ['#2f1913', '#23120e', '#22120d', '#301913', '#2e1813', '#2e1812'],
      cloth: ['#641913', '#431311', '#651913', '#441313', '#3a140f'],
      trim: ['#af7b2b', '#7b5722'],
      eyes: ['#a47c2c', '#e3b65f', '#e4b464', '#7c5434', '#895f34']
    },
    keep: ['#efd3bd', '#f0d4be', '#f2d7bc', '#f0d7c2', '#a77e79', '#cfb6a4', '#a59a94', '#6f4441', '#323433', '#313231', '#232423', '#2b2b2b', '#383838', '#282828', '#060605', '#040404', '#000000']
  },
  aqua: {
    slots: {
      main: ['#6b75b1', '#7883b0', '#6c76b2', '#6b75b2', '#6b75b0', '#6875b1', '#6c76b3'],
      shade: ['#404661', '#535874', '#4b527c', '#4a517b'],
      light: ['#adb9de'],
      white: ['#f1f4fa'],
      eyes: ['#596f91', '#5c7494', '#5c6c94', '#2a4675', '#244474', '#98a5bd', '#84a4cc']
    },
    keep: ['#b39678', '#7e6a54', '#806a55', '#6e6f70', '#473c3c', '#33292a', '#4b3f3f', '#3d3233', '#665046', '#ecefee', '#060505', '#040404', '#000000']
  },
  terra: {
    slots: {
      main: ['#486d3c', '#486e3c', '#496e3d', '#486e3d', '#466c3b', '#496f3d', '#476d3c', '#476c3b'],
      shade: ['#35512d', '#34502c', '#435538'],
      dark: ['#30301f'],
      cream: ['#dcd2ab', '#ddd3ac'],
      creamShade: ['#a19a7c', '#756b5b'],
      eyes: ['#acbcac', '#d4dcdc', '#94aca4', '#acb4ac', '#b4bcac']
    },
    keep: ['#dec4ac', '#d8c3ad', '#a79181', '#a89584', '#e6e2cf', '#2a292a', '#141415', '#2c2b2c', '#282828', '#232222', '#1c1c1c', '#462222', '#000000']
  },
  zephyr: {
    slots: {
      main: ['#f7c06e', '#f9be6e', '#f8c16e', '#f7c16e', '#fac471', '#f7c26e', '#ffba74'],
      red: ['#d15a43', '#d15c45', '#d25a43'],
      brown: ['#8e4f42'],
      trim: ['#af884b'],
      arrow: ['#90a3b9', '#8ea8c7', '#8da7c6'],
      eyes: ['#8c8c8c', '#949494', '#8e8d8e', '#444444', '#454341']
    },
    keep: ['#f8ca9b', '#f8cd9d', '#f9ca9b', '#fed4a6', '#fbcb9f', '#fbcb97', '#f9cb9e', '#bd9470', '#b88b6e', '#cfa882', '#e7c399', '#251e17', '#4b3118', '#c86d6c', '#f6f3ec', '#000000']
  }
};
