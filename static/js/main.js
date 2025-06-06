// Error handling
function handleError(error, context = '') {
    console.error(`Error ${context}:`, error);

    let message = 'Ocorreu um erro';
    if (error.response) {
        message = error.response.data?.message || `HTTP ${error.response.status}`;
    } else if (error.message) {
        message = error.message;
    }

    // Show error to user (you can customize this)
    alert(`Erro: ${message}`);
}