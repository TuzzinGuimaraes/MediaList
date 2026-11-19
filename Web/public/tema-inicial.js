// Aplica o tema antes do primeiro paint, sem piscar o escuro no tema claro. Mesma regra de
// src/tema/tema.ts: escuro é o padrão. Fica num arquivo (e não inline no index.html) para a
// CSP do nginx não precisar de 'unsafe-inline' nem de hash.
(function () {
  try {
    var p = localStorage.getItem('medialist.tema');
    var claro = p === 'claro' || (p === 'sistema' && matchMedia('(prefers-color-scheme: light)').matches);
    if (claro) document.documentElement.classList.add('claro');
  } catch (e) {}
})();
