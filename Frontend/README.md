# Frontend MediaList

O frontend principal do projeto é documentado no [README da raiz](/home/artur/anilist/Projeto_LabBancoDados/README.md).

## Desenvolvimento local

```bash
npm install
npm start
```

Por padrão:

- a aplicação local roda em `http://localhost:3005`
- o modo desenvolvimento consome a API em `http://localhost:5000/api`

## Build

```bash
npm run build
```

Para distribuição, o projeto usa [Frontend/Dockerfile](/home/artur/anilist/Projeto_LabBancoDados/Frontend/Dockerfile) e [Frontend/nginx.conf](/home/artur/anilist/Projeto_LabBancoDados/Frontend/nginx.conf) para servir o build estático por Nginx e fazer proxy de `/api` para o backend.
