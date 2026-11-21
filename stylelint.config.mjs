// Stylelint (ADR-014) : couleurs, tailles de police, espacements, z-index et ombres uniquement en var(--…) hors de
// tokens.css. Les fichiers .vue sont lus par postcss-html (blocs <style>).
export default {
  extends: ['stylelint-config-standard'],
  plugins: ['stylelint-declaration-strict-value'],
  ignoreFiles: ['app/assets/css/tokens.css', '.output/**', '.nuxt/**', 'node_modules/**', 'coverage/**'],
  overrides: [{ files: ['**/*.vue'], customSyntax: 'postcss-html' }],
  rules: {
    'scale-unlimited/declaration-strict-value': [
      [
        '/color$/',
        'fill',
        'stroke',
        'font-size',
        'font-family',
        'z-index',
        'box-shadow',
        'text-shadow',
        '/^(margin|padding|gap|row-gap|column-gap)/',
      ],
      {
        expandShorthand: true,
        recurseLonghand: true,
        ignoreValues: ['transparent', 'inherit', 'currentcolor', 'none', '0', 'auto', 'unset', 'initial'],
        disableFix: true,
      },
    ],
  },
}
