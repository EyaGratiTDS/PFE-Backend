// Test simple pour valider l'infrastructure Jest
describe('Infrastructure Test', () => {
  test('Jest is working', () => {
    expect(true).toBe(true);
  });

  test('Environment variables are set', () => {
    expect(process.env.NODE_ENV).toBe('test');
    expect(process.env.JWT_SECRET).toBeDefined();
    expect(process.env.ENCRYPTION_KEY).toBeDefined();
  });

  test('Mock functions work', () => {
    const mockFn = jest.fn();
    mockFn('test');
    expect(mockFn).toHaveBeenCalledWith('test');
  });
});
