import React, { useState } from 'react';
import { criarPagamento } from '../api/pagamento.js';

export default function CheckoutScreen() {
  const [carregando, setCarregando] = useState(false);

  const handlePagar = async () => {
    setCarregando(true);
    try {
      const dados = { plano: 'premium', valor: 29.90 };
      const resposta = await criarPagamento(dados);

      if (resposta.sucesso) {
        alert('Pagamento iniciado com sucesso!');
        // Aqui você pode redirecionar ou abrir o link de pagamento retornado
      } else {
        alert('Erro: ' + resposta.erro);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h2>Assinar Nexus Ride</h2>
      <button 
        onClick={handlePagar} 
        disabled={carregando}
        style={{ padding: '10px 20px', fontSize: '16px' }}
      >
        {carregando ? 'Processando...' : 'Pagar com PIX/Cartão'}
      </button>
    </div>
  );
}
