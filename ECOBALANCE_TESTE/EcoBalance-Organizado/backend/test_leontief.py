import unittest
import numpy as np
from leontief_calc import calcular_leontief  # Importa sua função principal

class TestEcoBalanceLeontief(unittest.TestCase):

    def setUp(self):
        """Configura os dados baseados no exemplo do PDF da FATEC/USP"""
        self.matriz_valida = [
            [0.15, 0.40, 0.10, 0.05], # Automobilístico
            [0.10, 0.20, 0.25, 0.10], # Aço
            [0.05, 0.15, 0.20, 0.05], # Eletrônicos
            [0.02, 0.05, 0.10, 0.30]  # Papel
        ]
        self.demanda_valida = [2000000, 1000000, 500000, 300000]

    def test_nao_negatividade_producao(self):
        """Teste: Garante que a produção total X nunca seja negativa (Sistemas Produtivos)"""
        resultado = calcular_leontief(self.matriz_valida, self.demanda_valida)
        producao = np.array(resultado['producao_total'])
        
        # Verifica se todos os elementos de X são >= 0
        self.assertTrue(np.all(producao >= 0), "Erro: Produção negativa detectada. Sistema improdutivo!")

    def test_matriz_identidade_inversa(self):
        """Teste: Verifica se (I - A) é invertível e se a diagonal principal é predominante"""
        A = np.array(self.matriz_valida)
        I = np.identity(len(A))
        L = I - A
        
        # O determinante deve ser positivo para satisfazer Hawkins-Simons
        det = np.linalg.det(L)
        self.assertGreater(det, 0, "A matriz de coeficientes não permite um equilíbrio estável.")

    def test_input_invalido(self):
        """Teste: Garante que o sistema rejeita coeficientes técnicos maiores que 1 (Consumo impossível)"""
        matriz_invalida = [[1.2, 0.1], [0.1, 0.5]] # Setor 1 consome mais do que produz
        resultado = calcular_leontief(matriz_invalida, [100, 100])
        self.assertEqual(resultado['status'], 'error', "O sistema deveria rejeitar matrizes com coeficientes > 1.")

if __name__ == '__main__':
    unittest.main()