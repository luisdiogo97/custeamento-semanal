# Custeamento semanal

Plataforma web da Movecho para o custeamento semanal das obras: orçamento por rubrica, registo semanal do real, controlo de desvios, painel de todas as obras e exportação de resumos em Excel e PDF.

## Como funciona

- `site/` é a página publicada no GitHub Pages (workflow `.github/workflows/publicar.yml`, a cada alteração no ramo `main`).
- Os dados (obras, parâmetros, pessoas e taxas) vivem no Firebase Firestore, nunca neste repositório.
- Só entra quem confirmou o email e está na coleção `acessos` do Firestore. Os administradores gerem essa lista no menu da conta › Gerir acessos.
- `firestore.rules` tem as regras de segurança da base de dados (copiar para Firebase › Firestore › Regras sempre que mudarem).
- `site/config.js` tem a configuração pública da app web do Firebase.
- Cada gravação guarda, no máximo de 15 em 15 minutos por documento e por navegador, uma cópia na coleção `historico`.

## Testar localmente

Com o Firebase CLI: `firebase emulators:start --only auth,firestore --project demo-custeamento` e sirva a pasta `site/` com um `config.js` que tenha `emulador: {}`.
