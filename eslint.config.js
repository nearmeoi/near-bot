import js from '@eslint/js'

export default [
    js.configs.recommended,
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
        },
        rules: {
            'no-unused-vars': 'off',
            'no-undef': 'off',
            'semi': 'off',
            'indent': 'off',
            'no-console': 'off',
            'no-await-in-loop': 'off',
            'no-promise-executor-return': 'off',
            'no-prototype-builtins': 'off',
            'no-empty': 'off',
            'no-useless-assignment': 'off',
            'no-case-declarations': 'off',
            'no-useless-escape': 'off',
        },
    },
]
