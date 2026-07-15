module.exports = {
    preset: 'jest-preset-angular',
    setupFilesAfterEnv: ['<rootDir>/setup-jest.ts'],
    testMatch: ['**/__tests__/**/*.test.ts'],
    collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/__tests__/**'],
    // Source uses explicit .js extensions on relative imports (required by
    // moduleResolution: node16 for real ESM output); Jest's CJS-based
    // resolver doesn't know that maps back to the .ts source, so strip it.
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
    },
};
