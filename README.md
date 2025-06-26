# n8n MCP Playwright統合 Docker セットアップ

このプロジェクトは、n8n、MCP (Model Context Protocol)、およびPlaywrightを統合したDockerベースの自動化ソリューションです。ブラウザ自動化タスクをn8nワークフロー内で実行できる強力な環境を提供します。

## 🏗️ アーキテクチャ

- **n8n**: ワークフロー自動化プラットフォーム (ポート5678)
- **Playwright**: ブラウザ自動化ライブラリ (Chromium/Firefox/WebKit対応)
- **MCP Server**: RESTful APIベースのPlaywright統合サーバー (ポート8080)

## 🚀 クイックスタート

### 1. 前提条件

- **Docker**: 24.0.x以上
- **Docker Compose**: v2.0以上
- **システム要件**: 
  - 最低4GB RAM (推奨8GB)
  - 20GB以上の空きディスク容量
  - macOS 12+, Ubuntu 20.04+, Windows 10+

### 2. 起動

```bash
# プロジェクトディレクトリに移動
cd n8n-mcp-playwright

# Docker Composeでサービスを起動
docker-compose up -d

# 起動完了まで約5分待機 (初回はPlaywrightブラウザダウンロード)
# ログで進行状況を確認
docker-compose logs -f mcp-server
```

### 3. アクセス確認

```bash
# n8n Web UI
open http://localhost:5678

# MCP Server ヘルスチェック
curl http://localhost:8080/health

# 利用可能ツール一覧
curl http://localhost:8080/tools
```

### 4. 停止

```bash
# サービスを停止
docker-compose down

# ボリュームも削除する場合 (データ完全削除)
docker-compose down -v
```

## 🛠️ 利用可能なPlaywrightツール

MCPサーバーは以下の7つのツールを提供します:

| ツール名 | 説明 | 必須パラメータ |
|---|---|---|
| `launch_browser` | ブラウザインスタンスを起動 | - |
| `navigate_to` | 指定URLに移動 | `browserId`, `url` |
| `click_element` | 要素をクリック | `browserId`, `selector` |
| `type_text` | テキストを入力 | `browserId`, `selector`, `text` |
| `get_text` | 要素のテキストを取得 | `browserId`, `selector` |
| `screenshot` | スクリーンショットを撮影 | `browserId` |
| `close_browser` | ブラウザを閉じる | `browserId` |

## 📝 使用例

### ブラウザの起動とWebサイト操作

```bash
# 1. ブラウザを起動
curl -X POST http://localhost:8080/tools/execute \
  -H "Content-Type: application/json" \
  -d '{"name":"launch_browser","arguments":{"headless":true}}'

# レスポンス例: {"success":true,"result":{"browserId":"browser_xxx",...}}

# 2. Webサイトに移動
curl -X POST http://localhost:8080/tools/execute \
  -H "Content-Type: application/json" \
  -d '{"name":"navigate_to","arguments":{"browserId":"browser_xxx","url":"https://example.com"}}'

# 3. 要素をクリック
curl -X POST http://localhost:8080/tools/execute \
  -H "Content-Type: application/json" \
  -d '{"name":"click_element","arguments":{"browserId":"browser_xxx","selector":"button#submit"}}'

# 4. テキストを入力
curl -X POST http://localhost:8080/tools/execute \
  -H "Content-Type: application/json" \
  -d '{"name":"type_text","arguments":{"browserId":"browser_xxx","selector":"input[name=\"email\"]","text":"test@example.com"}}'

# 5. スクリーンショットを撮影
curl -X POST http://localhost:8080/tools/execute \
  -H "Content-Type: application/json" \
  -d '{"name":"screenshot","arguments":{"browserId":"browser_xxx","fullPage":true}}'

# 6. ブラウザを閉じる
curl -X POST http://localhost:8080/tools/execute \
  -H "Content-Type: application/json" \
  -d '{"name":"close_browser","arguments":{"browserId":"browser_xxx"}}'
```

## 📊 サービス状態確認

```bash
# 全サービスの状態確認
docker-compose ps

# 各サービスのヘルスチェック
docker-compose exec n8n curl -f http://localhost:5678
docker-compose exec mcp-server curl -f http://localhost:8080/health

# 現在稼働中のブラウザ一覧
curl http://localhost:8080/browsers
```

## 🔧 トラブルシューティング

### 一般的な問題と解決方法

#### 1. Docker権限エラー
```bash
# dockerグループにユーザーを追加
sudo usermod -aG docker $USER
# 再ログインまたはnewgrp docker実行
```

#### 2. ポート競合エラー
以下のポートが使用されていないことを確認:
- `5678`: n8n Web UI
- `8080`: MCP Server API

```bash
# ポート使用状況確認
lsof -i :5678
lsof -i :8080
```

#### 3. メモリ不足エラー
```bash
# docker-compose.ymlで各サービスのメモリ制限を調整
# または system 全体のメモリを増設
free -h
```

#### 4. Playwrightブラウザ起動失敗
```bash
# コンテナを再作成 (ブラウザ再ダウンロード)
docker-compose down
docker-compose up -d --force-recreate mcp-server
```

#### 5. n8nが起動しない
```bash
# n8nのログを確認
docker-compose logs n8n

# データボリュームをリセット
docker-compose down -v
docker-compose up -d
```

### ログ確認方法

```bash
# 全サービスのログ
docker-compose logs

# 特定サービスのログ
docker-compose logs mcp-server
docker-compose logs n8n
docker-compose logs playwright

# リアルタイムログ監視
docker-compose logs -f mcp-server
```

## ⚙️ 設定カスタマイズ

### 環境変数 (.env)

```bash
# n8n設定
N8N_HOST=0.0.0.0
N8N_PORT=5678
N8N_PROTOCOL=http

# MCP Server設定
MCP_SERVER_PORT=8080
MCP_CONNECTION_TIMEOUT=60000
MCP_RETRY_ATTEMPTS=3

# Playwright設定
PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright
```

### Docker Composeカスタマイズ

```yaml
# メモリ制限を変更する場合
services:
  mcp-server:
    deploy:
      resources:
        limits:
          memory: 2G  # デフォルト1Gから変更
```

## 📁 プロジェクト構成

```
n8n-mcp-playwright/
├── .env                    # 環境変数設定
├── docker-compose.yml      # Docker Compose設定
├── README.md              # このファイル
├── DEPLOYMENT_STATUS.md   # デプロイメント状況
├── mcp-config/
│   └── mcp-config.json    # MCP設定ファイル
└── mcp-server/
    ├── package.json       # Node.js依存関係
    └── server.js          # RESTベースMCPサーバー
```

## 🔄 継続的な監視

### ヘルスチェック監視スクリプト

```bash
#!/bin/bash
# health_check.sh
echo "=== n8n MCP Playwright Health Check ==="
echo "n8n: $(curl -s -o /dev/null -w "%{http_code}" http://localhost:5678)"
echo "MCP Server: $(curl -s http://localhost:8080/health | jq -r .status)"
echo "Browsers: $(curl -s http://localhost:8080/browsers | jq -r .count)"
```

## 📚 参考資料

- [n8n Documentation](https://docs.n8n.io/)
- [Playwright Documentation](https://playwright.dev/)
- [Docker Compose Reference](https://docs.docker.com/compose/)

## 🐛 バグレポート・機能要望

問題が発生した場合は、以下の情報を含めてIssueを作成してください:

1. OS/環境情報
2. Docker/Docker Composeバージョン
3. `docker-compose logs`の出力
4. 再現手順

---

**最終更新**: 2025-06-26  
**検証済みバージョン**: Docker 25.0.2, Docker Compose v2.24.3