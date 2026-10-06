# 完全ローカル処理の確認

Image Pipeline Builderは画像をブラウザ内で処理する設計です。

## ビルド時

standalone verifierでは主に以下を確認します。

- `connect-src 'none'`
- 未解決のビルドplaceholderがないこと
- 実行時に外部script/styleを読み込まないこと
- faviconと左上ブランドアイコンが同じ埋め込みSVGであること

Windows:

```powershell
.\scripts\check-powershell-syntax.ps1
.\scripts\check-repository.ps1
```

または `build-standalone.bat` を実行します。

## 実行時

1. `dist/index.html` を開きます。
2. DevToolsのNetworkを開きます。
3. ページを再読み込みします。
4. JPEG / PNG / WebPを複数追加します。
5. 2本目のResize / Output branchを追加し、Outputごとに異なるZIP内フォルダを設定します。
6. Adjust → Text WatermarkなどAppearance / Compositionノードを追加し、変更前 / 変更後が選択ノードの境界になることを確認します。
7. Grayscale / Blur / Sharpenで寸法が維持されること、外側Borderで寸法が増えること、Rounded Cornersで四隅が透明になること、Text WatermarkでOS標準フォントの文字が描画されることを確認します。
8. 変更していないPreviewへ戻り「キャッシュを再利用」になることを確認します。下流Outputだけを変えた場合も上流Previewを再利用できることを確認します。
9. **テンプレート**から「メイン画像＋サムネイル」を適用し、通常の編集可能な5ノード / 2 Outputとして展開されることを確認します。
10. 現在のPipelineを**Recipe**として名前付き登録し、画面上部にRecipeカードが表示されることを確認します。カードで複数画像を選び、**このRecipeを使う**では現在のCanvasを変えずにBatch結果が生成されること、**Canvasに反映**ではRecipeと選択画像が編集状態へ読み込まれることを確認します。
11. Recipeライブラリで登録済みRecipeの利用・更新・削除を確認します。**Pipeline保存 / Pipelineを開く**でJSONを書き出し、別フローへ変更後に読み込んで元のGraphへ戻ることを確認します。
12. DevToolsのApplication / Local Storageで、Recipe / 自動復元データにGraphと設定はある一方、読み込んだ画像ファイル名/バイト列、Quick Recipeで選んだ画像、Preview、Batch Blobが保存されていないことを確認します。ページを開き直すとGraphは復元され、画像は未選択になることを確認します。
12. Outputの変更後で代表画像の実エンコードサイズを確認し、一括処理を実行して結果一覧とZIP内相対パスを確認します。
13. ZIPを保存し、想定外の外部通信がないことを確認します。ネットワークを無効にして同じ操作を繰り返します。

失敗状態の確認では、正常画像と意図的に壊した画像を一緒に追加します。壊れた1件だけが失敗し、正常画像の処理が続くことを確認します。

画像ファイル、デコード後の画素、Appearance / Composition処理、Before / After Preview、表示用snapshot、Preview cache、Batch結果、出力Blob、生成ZIPはブラウザ内に留まります。v1.0.1はアクセス解析・テレメトリ・クラウド保存・画像API・外部フォントを使用しません。現在のPipeline自動復元 / Recipe保存は端末内のブラウザ保存領域だけを使い、画像ファイル自体は保存しません。Recipeカードで一時選択した画像も永続化しません。

## Mobile / UX / Accessibility確認 (v1.0.1)

390px幅でフロー / 画像 / ノード / 実行の下部タブ、ノード追加Bottom Sheet、長いファイル名、Recipe/Template/Help Dialog、Toast、浮かせて拡大したWorkspaceを確認します。ページ全体の横スクロールが発生せず、固定ナビゲーションが操作部や結果を隠さないことを確認します。

Palette検索と `Ctrl+Enter` / `Command+Enter` のBatch実行もブラウザ内だけで動作し、外部通信を追加しません。

## v1.0.1 UI回帰確認

- **全体を表示** とキャンバス拡大のアイコンが見分けられること。
- PCで左右パネルを開いた状態でも、下部のフローステータス行が完全に表示されること。

1. PCで左のノード一覧から任意ノードをCanvasへドラッグし、ドロップ位置付近へ配置されることを確認します。クリック追加も引き続き動作することを確認します。
2. 正方形Cropや縦長/横長画像のPreviewで、表示領域に合わせても縦横比が変わらないことを確認します。
3. 保存済みRecipeで画像を選び **このRecipeを使う** を押し、1出力なら画像、複数出力ならZIPが処理完了後に自動保存されることを確認します。
4. PCで左「ノード」と右「ノード設定」がEditorと同じ固定高になり、内容が長い場合は各パネル内部だけがスクロールすることを確認します。
