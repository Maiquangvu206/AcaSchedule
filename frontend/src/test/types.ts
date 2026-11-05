// Type declaration stubs for vitest and @testing-library/react.
// These are placeholders until the actual packages are installed via npm.
// Remove this file once vitest and @testing-library/* are installed.

declare module 'vitest' {
  export function describe(name: string, fn: () => void): void;
  export function it(name: string, fn: () => void | Promise<void>): void;
  export function expect(actual: any): {
    toBe: (expected: any) => void;
    toEqual: (expected: any) => void;
    toHaveBeenCalled: () => void;
    toHaveBeenCalledTimes: (n: number) => void;
    toHaveBeenCalledWith: (...args: any[]) => void;
    toThrow: () => void;
    toMatchObject: (obj: any) => void;
    [key: string]: any;
  };
  export const vi: {
    fn: () => any;
    mockReset: () => void;
    clearAllMocks: () => void;
    resetAllMocks: () => void;
    [key: string]: any;
  };
  export function beforeEach(fn: () => void): void;
  export function afterEach(fn: () => void): void;
}

declare module '@testing-library/react' {
  export function render(ui: any): {
    getByText: (text: string) => any;
    getByRole: (role: string) => any;
    queryByText: (text: string) => any;
    container: HTMLElement;
    [key: string]: any;
  };
  export const screen: {
    getByText: (text: string) => any;
    getByRole: (role: string) => any;
    queryByText: (text: string) => any;
    [key: string]: any;
  };
  export function act(cb: () => void | Promise<void>): void;
  export function renderHook<T>(cb: () => T): { result: { current: T }; [key: string]: any };
  export function cleanup(): void;
}
