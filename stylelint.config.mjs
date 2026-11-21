// Stylelint (ADR-014): colours, font sizes, spacing, z-index and shadows only as var(--…) outside
// tokens.css. .vue files are read by postcss-html (<style> blocks).
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
