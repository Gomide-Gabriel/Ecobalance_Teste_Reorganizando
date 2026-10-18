import numpy as np
import json
import sys

def erro(msg):
    return {"status": "error", "message": msg}

def calcular_leontief(matriz_coeficientes, demanda_final):
    try:
        A = np.array(matriz_coeficientes, dtype=float)
        d = np.array(demanda_final, dtype=float)
    except (ValueError, TypeError):
        return erro("Matriz ou demanda com valores não numéricos.")

    if A.ndim != 2 or A.shape[0] == 0 or A.shape[0] != A.shape[1]:
        return erro("A matriz deve ser quadrada e não vazia.")
    n = A.shape[0]
    if d.shape != (n,):
        return erro("A demanda deve ter um valor por setor (tamanho da matriz).")
    if not (np.isfinite(A).all() and np.isfinite(d).all()):
        return erro("Valores inválidos (NaN ou infinito).")
    if (A < 0).any() or (d < 0).any():
        return erro("Coeficientes e demanda não podem ser negativos.")

    # Hawkins-Simons: para A >= 0, a matriz é produtiva se o raio espectral < 1
    raio = float(max(abs(np.linalg.eigvals(A))))
    if raio >= 1:
        return erro(f"Matriz não produtiva (raio espectral = {raio:.4f} >= 1).")

    try:
        inversa_L = np.linalg.inv(np.identity(n) - A)
    except np.linalg.LinAlgError:
        return erro("Matriz não invertível.")

    # Produção Total Necessária: X = (I - A)^-1 * d
    producao_total = inversa_L.dot(d)
    return {
        "status": "success",
        "producao_total": producao_total.tolist(),
        "inversa": inversa_L.tolist(),
        "raio_espectral": raio
    }

if __name__ == "__main__":
    try:
        input_data = json.loads(sys.stdin.read())
        resultado = calcular_leontief(input_data['matriz'], input_data['demanda'])
    except (json.JSONDecodeError, KeyError):
        resultado = erro("Entrada inválida: esperado JSON com 'matriz' e 'demanda'.")
    print(json.dumps(resultado))