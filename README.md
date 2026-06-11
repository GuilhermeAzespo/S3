# eveo S3 - Object Storage

![eveo S3](https://img.shields.io/badge/Status-Active-success) ![Docker](https://img.shields.io/badge/Docker-Supported-blue) ![Node.js](https://img.shields.io/badge/Node.js-Backend-green) ![React](https://img.shields.io/badge/React-Frontend-61DAFB)

O **eveo S3** é um sistema de armazenamento de objetos (Object Storage) construído para ser leve, rápido e fácil de hospedar em ambientes como Easypanel ou Docker puro. Ele oferece funcionalidades essenciais de gerenciamento de arquivos com uma interface moderna e dark mode inspirada nos melhores painéis do mercado.

## 🚀 Funcionalidades

- **Gerenciamento de Buckets**: Crie buckets privados ou públicos para organizar seus arquivos.
- **Cotas de Armazenamento**: Defina limites de tamanho (Quotas) por bucket para evitar o consumo excessivo de disco.
- **Ciclo de Vida (Lifetime)**: Configure regras para expiração automática de arquivos (ex: deletar arquivos da pasta `/temp` após 7 dias).
- **Interface Web Moderna**: Dashboard intuitivo com gráficos de consumo e listagem detalhada, construído em React e TailwindCSS.
- **Leve e Autossuficiente**: Utiliza SQLite para metadados, dispensando a necessidade de levantar containers de banco de dados pesados.

## 🛠️ Tecnologias Utilizadas

- **Frontend**: React, Vite, TailwindCSS, Lucide Icons.
- **Backend**: Node.js, Express, Prisma ORM, Multer.
- **Infraestrutura**: Docker multi-stage build.

## 📦 Como Instalar e Rodar

A maneira mais fácil de rodar o projeto é via Docker. Um arquivo `docker-compose.yml` está incluso na raiz do projeto.

### 1. Rodando localmente com Docker Compose

```bash
# Clone o repositório
git clone https://github.com/GuilhermeAzespo/S3.git
cd S3

# Suba os containers
docker-compose up -d --build
```

Acesse a interface web em `http://localhost:3000`.

### 2. Configuração Inicial (Setup do Admin)

Ao subir a aplicação pela primeira vez, você precisa criar o usuário administrador padrão. Execute o seguinte comando no seu terminal:

```bash
curl -X POST http://localhost:3000/api/auth/setup
```

Isso criará o usuário:
- **Login**: `admin`
- **Senha**: `admin123`

> ⚠️ **Atenção**: Mude sua senha imediatamente após o primeiro login e altere o `JWT_SECRET` no arquivo `docker-compose.yml` para produção!

## ☁️ Deploy no Easypanel

O projeto está estruturado para ser implantado facilmente no Easypanel utilizando o Dockerfile. Siga o passo a passo exato:

1. No Easypanel, crie um novo **App** (ex: `s3`).
2. Vá até a aba **Fonte (Source)**, selecione a opção **Git** e preencha os campos da seguinte forma:
   - **URL do Repositório**: `https://github.com/GuilhermeAzespo/S3.git`
   - **Ramo (Branch)**: `main`
   - **Caminho de Build (Build Path)**: `/`
   - Clique em **Salvar**.
3. Na aba **Avançado (Advanced)**, verifique se o **Build Type** está selecionado como **Dockerfile** (e não Nixpacks).
4. Na aba **Ambiente (Environment)**, adicione as seguintes variáveis de ambiente:
   - `PORT=3000`
   - `JWT_SECRET=escreva_uma_senha_aleatoria_longa_aqui`
5. Na aba **Montagens (Mounts)**, crie um mapeamento de volume para os arquivos não se perderem ao atualizar o sistema:
   - **Type**: `Volume`
   - **Mount Path**: `/app/storage`
6. Por fim, clique no botão **Deploy** e aguarde o build finalizar!

## 📄 Estrutura do Projeto

```text
├── backend/            # API Node.js (Express, Prisma, SQLite)
├── frontend/           # Interface Web (React, Vite)
├── Dockerfile          # Build multi-stage da aplicação completa
├── docker-compose.yml  # Orquestração local
└── README.md
```
