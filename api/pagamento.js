import { apiFetch } from './fetch.js';

export async function criarPagamento(dadosPagamento) {
  try {
    // Substitua pela URL do seu endpoint de backend ou gateway
    const endpoint = 'https://api.seubackend.com/pagamentos';
    
    const resultado = await apiFetch(endpoint, {
      method: 'POST',
      body: JSON.stringify(dadosPagamento),
    });

    return {
      sucesso: true,
      dados: resultado,
    };
  } catch (error) {
    return {
      sucesso: false,
      erro: error.message,
    };
  }
}
