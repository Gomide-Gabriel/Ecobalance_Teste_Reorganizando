import numpy as np
import json
import sys

def calcular_leontief(matriz_coeficientes, demanda_final):
    # I = Matriz Identidade
    I = np.identity(len(matriz_coeficientes))
    # A = Matriz de Coeficientes Técnicos (Insumos)
    A = np.array(matriz_coeficientes)
    
    try:
        # Matriz de Leontief: (I - A)
        L = I - A
        # Inversa de Leontief: (I - A)^-1
        inversa_L = np.linalg.inv(L)
        
        # Produção Total Necessária: X = (I - A)^-1 * d
        producao_total = inversa_L.dot(np.array(demanda_final))
        
        return {
            "status": "success",
            "producao_total": producao_total.tolist(),
            "inversa": inversa_L.tolist()
        }
    except np.linalg.LinAlgError:
        return {"status": "error", "message": "Matriz não invertível (Sistema Instável)"}

if __name__ == "__main__":
    # Recebe dados via STDIN do Node.js
    input_data = json.loads(sys.stdin.read())
    resultado = calcular_leontief(input_data['matriz'], input_data['demanda'])
    print(json.dumps(resultado))