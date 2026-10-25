# SuinoTech — Guia rápido para a apresentação

Tudo o que você precisa no dia da apresentação, sem consultar mais nada.

---

## Antes do dia (uma vez)

1. Na pasta `backend`, rode `npm install` (se ainda não rodou) e depois
   `npm test` — todos os testes devem aparecer com ✔.
2. Quer começar a apresentação com o painel zerado? Com o servidor
   **parado**, apague o arquivo `backend/database/dados.json`. Ele é
   recriado vazio na próxima vez que o servidor subir.

---

## ▶ Como iniciar

1. Abra o VSCode com a pasta `suinotech-monitoramento` aberta
   (File → Open Folder, se não abrir sozinho).
2. Abra o terminal: **Terminal → New Terminal**.
3. Digite:
   ```bash
   cd backend
   npm start
   ```
4. Espere aparecer:
   ```
   SuinoTech rodando em  http://localhost:3000
   ```
   **Não feche essa aba do terminal** — deixe rodando durante toda a
   apresentação.
5. Abra o **Google Chrome** (ou Edge) e acesse: `localhost:3000`

> **Sem internet?** O sistema funciona do mesmo jeito: painel, tempo real,
> histórico e exportação. Só o suíno 3D do topo vira uma foto e as
> animações ficam mais simples.

### Se for usar o Arduino de verdade
Na seção **Painel**, clique em **"Conectar Arduino (USB)"**, escolha a
porta do Arduino na janela que o Chrome mostrar, e pronto — os eventos dos
sensores aparecem no site em tempo real.

### Se NÃO for usar o Arduino (só demonstrar o site)
Abra um **segundo terminal** (ícone "+" no painel do terminal) e rode:
```bash
cd backend
npm run simulate
```
Isso gera eventos automáticos a cada poucos segundos — ótimo para deixar
rodando enquanto vocês explicam o projeto. Também dá para usar os botões
**"Simular entrada"** / **"Simular saída"** do painel, manualmente.

### Mostrando o alerta de capacidade (caso de teste CT07)
O alerta de **atenção** aparece quando uma baia chega a 26 animais (85%)
e o **crítico** em 30. Com os botões ou o simulador isso demora, porque os
eventos se espalham pelas 4 baias. Para mostrar na hora, abra outro
terminal (com o servidor rodando) e cole no PowerShell:

```powershell
1..26 | % { Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/eventos -ContentType application/json -Body '{"baia":"C","tipo":"entrada","origem":"demo"}' }
```

A baia C fica em atenção. Rode com `1..4` em vez de `1..26` para chegar
a 30 e mostrar o alerta crítico.

---

## ⏹ Como desligar (ao terminar)

1. Se o simulador estiver rodando (segundo terminal), clique nele e
   aperte **Ctrl+C**.
2. Clique no terminal principal (o que mostra "SuinoTech rodando...")
   e aperte **Ctrl+C**.
3. Pode fechar a aba do Chrome e o VSCode normalmente.

Não fica nenhum processo rodando "escondido": encerrados os dois terminais
com Ctrl+C, está tudo desligado.

---

## 🆘 Problemas rápidos

| Sintoma | Solução |
|---|---|
| `npm` não é reconhecido | Node.js não está instalado — baixe em nodejs.org (versão LTS), instale, feche e reabra o VSCode |
| Erro de "execução de scripts desabilitada" no PowerShell | Rode uma vez: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` e confirme com **S** |
| Site não abre em localhost:3000 | Confira se o terminal ainda mostra o servidor rodando (sem erro vermelho) |
| Arduino não aparece na lista ao clicar em Conectar | Feche o Monitor Serial da Arduino IDE antes — só um programa pode usar a porta USB por vez |
| Botão "Conectar Arduino" desabilitado | Você está usando Firefox ou Safari — troque para Chrome ou Edge |
| Status mostra "evento(s) aguardando o servidor" | O servidor caiu: rode `npm start` de novo — os eventos guardados são enviados sozinhos |
| Excel abriu o CSV tudo numa coluna | Use o botão "Exportar CSV" do site (ele já sai no formato do Excel em português) |
