# Blefe

Jogo de cartas de blefe para celular, de 2 a 6 jogadores, cada um no seu aparelho. Não precisa de conta: cada um entra com um apelido e o código da mesa.

## Como publicar (uns 10 minutos, tudo grátis)

### 1. GitHub
1. Entre em github.com, clique em **New repository**, dê o nome `blefe` e marque **Private**.
2. Na página do repositório vazio, clique em **uploading an existing file**.
3. Arraste **o conteúdo desta pasta** (`index.html`, `package.json`, `README.md` e a pasta `api`) e clique em **Commit changes**.
   Confira se o arquivo ficou em `api/db.js`, dentro da pasta `api`.

### 2. Vercel
1. Entre em vercel.com com a sua conta do GitHub.
2. **Add New… → Project**, escolha o repositório `blefe` e clique em **Deploy**. Não precisa mudar nenhuma configuração.

### 3. Banco do jogo (Upstash Redis)
1. No projeto, no Vercel, abra a aba **Storage**, clique em **Create Database** e escolha **Upstash → Redis** (plano Free).
2. Conecte o banco ao projeto `blefe`. As variáveis `KV_REST_API_URL` e `KV_REST_API_TOKEN` são criadas sozinhas.
3. Volte em **Deployments**, abra o menu `…` do último deploy e clique em **Redeploy**. Isso é necessário para o site enxergar o banco.

Pronto: abra o endereço `https://blefe-xxxx.vercel.app` no celular e mande para a galera.

## Testar sozinho
Abra o site com `?p=1` numa aba e `?p=2` em outra: cada aba vira um jogador diferente.

## Bom saber
- As mesas somem sozinhas 3 dias depois da última jogada.
- O plano grátis do Upstash aguenta muitas partidas por mês. Cada celular consulta a mesa cerca de uma vez por segundo, e só enquanto o jogo está aberto na tela.
- As cartas ficam escondidas na tela, mas o estado da mesa passa pelo navegador. Entre amigos tudo bem, só não vale apostar.
- Para mudar o jogo, edite o `src.html` na pasta do projeto, rode `python3 build.py` e suba o novo `index.html` no GitHub. O Vercel publica sozinho.
