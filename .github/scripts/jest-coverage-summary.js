// Converte o coverage-summary.json do jest (reporter json-summary) numa tabela
// markdown para o GITHUB_STEP_SUMMARY. Só relatório: nunca falha o job.
// Uso: node jest-coverage-summary.js <coverage-summary.json> <título>
const fs = require('fs');

const [arquivo, titulo = 'Cobertura'] = process.argv.slice(2);

let total;
try {
    total = JSON.parse(fs.readFileSync(arquivo, 'utf8')).total;
} catch (erro) {
    console.log(`### ${titulo}\n\nResumo de cobertura indisponível (${erro.message}).`);
    process.exit(0);
}

const linhas = ['statements', 'branches', 'functions', 'lines'].map((chave) => {
    const { covered, total: quantidade, pct } = total[chave];
    return `| ${chave} | ${pct}% | ${covered}/${quantidade} |`;
});

console.log([`### ${titulo}`, '', '| Métrica | % | Cobertos |', '| --- | ---: | ---: |', ...linhas].join('\n'));
