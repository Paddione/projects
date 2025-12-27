const mockGlob = jest.fn();
// Export as both named and default to match different import styles
export const glob = mockGlob;
export { mockGlob };
export default { glob: mockGlob };
