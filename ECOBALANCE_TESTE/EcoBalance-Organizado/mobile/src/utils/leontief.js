/**
 * Motor algébrico Insumo-Produto de Leontief — equivalente em JS
 * ao módulo Python/NumPy `leontief_engine.py` descrito no artigo:
 *   X = (I - C)^(-1) · d, com validação da Condição de Hawkins-Simons (det(I-C) > 0)
 */

// Inversão de matriz via Eliminação de Gauss-Jordan
export function invert(matrix) {
  const n = matrix.length;
  const a = matrix.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);

  for (let col = 0; col < n; col++) {
    // Pivoteamento parcial
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(a[row][col]) > Math.abs(a[maxRow][col])) maxRow = row;
    }
    [a[col], a[maxRow]] = [a[maxRow], a[col]];

    const pivot = a[col][col];
    if (Math.abs(pivot) < 1e-12) throw new Error("Matriz singular");
    for (let j = 0; j < 2 * n; j++) a[col][j] /= pivot;

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = a[row][col];
      for (let j = 0; j < 2 * n; j++) a[row][j] -= factor * a[col][j];
    }
  }
  return a.map((row) => row.slice(n));
}

export function determinant(matrix) {
  const n = matrix.length;
  const a = matrix.map((r) => [...r]);
  let det = 1;
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(a[row][col]) > Math.abs(a[maxRow][col])) maxRow = row;
    }
    if (maxRow !== col) { [a[col], a[maxRow]] = [a[maxRow], a[col]]; det *= -1; }
    det *= a[col][col];
    if (Math.abs(a[col][col]) < 1e-12) return 0;
    for (let row = col + 1; row < n; row++) {
      const factor = a[row][col] / a[col][col];
      for (let j = col; j < n; j++) a[row][j] -= factor * a[col][j];
    }
  }
  return det;
}

export function identity(n) {
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))
  );
}

export function multiply(m, v) {
  return m.map((row) => row.reduce((acc, val, j) => acc + val * v[j], 0));
}

export function subtract(a, b) {
  return a.map((row, i) => row.map((val, j) => val - b[i][j]));
}

/**
 * Calcula o vetor de produção total X.
 * @param {number[][]} C - matriz de coeficientes técnicos
 * @param {number[]} d - vetor de demanda final
 * @returns {{status:string, producaoTotal?:number[], determinante?:number, inversa?:number[][], message?:string}}
 */
export function calcularLeontief(C, d) {
  const n = C.length;
  const L = subtract(identity(n), C);
  const det = determinant(L);

  if (det <= 0) {
    return {
      status: "error",
      message: "Sistema Improdutivo: Det(I-A) <= 0 (Violação de Hawkins-Simons)",
    };
  }

  const inversa = invert(L);
  const producaoTotal = multiply(inversa, d);

  return {
    status: "success",
    producaoTotal: producaoTotal.map((x) => +x.toFixed(4)),
    determinante: +det.toFixed(6),
    inversa,
  };
}

/**
 * Simulador de sensibilidade: ΔX = (I - C - ΔB)^(-1) · d − X₀
 * ΔB é aplicada como redução proporcional nas colunas dos setores afetados.
 */
export function simularSensibilidade(C, d, deltaB) {
  const Cmod = C.map((row) => row.map((v) => v));
  // deltaB: { setorIndex: percentualReducao (0-1) }
  Object.entries(deltaB).forEach(([idx, reducao]) => {
    for (let i = 0; i < Cmod.length; i++) {
      Cmod[i][idx] = Math.max(0, Cmod[i][idx] * (1 - reducao));
    }
  });

  const base = calcularLeontief(C, d);
  const mod = calcularLeontief(Cmod, d);
  if (base.status !== "success" || mod.status !== "success") {
    return { status: "error", message: mod.message };
  }

  const deltaX = mod.producaoTotal.map((x, i) => +(x - base.producaoTotal[i]).toFixed(4));
  const deltaXPerc = base.producaoTotal.map((x0, i) =>
    x0 !== 0 ? +(((mod.producaoTotal[i] - x0) / x0) * 100).toFixed(2) : 0
  );

  return { status: "success", producaoBase: base.producaoTotal, producaoMod: mod.producaoTotal, deltaX, deltaXPerc };
}

export function formatBRL(v) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}