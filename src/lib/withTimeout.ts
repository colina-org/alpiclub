/**
 * Watchdog para promises (ou thenables, como PostgrestBuilder) que podem pendurar.
 * Evita estados "Salvando..." infinitos quando a request trava por
 * problema de rede, lock, etc.
 */
export function withTimeout<T>(
  promise: PromiseLike<T>,
  ms = 15000,
  label = 'operação',
): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Tempo esgotado (${label}). Tente novamente.`)),
        ms,
      ),
    ),
  ])
}
