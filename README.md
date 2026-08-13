# 今天吃什么 · 两个人的家常菜

内置 **50 道精选家常菜**（炒猪肉 / 炒牛肉 / 炒蔬菜 / 炒鸡蛋 / 快手汤，辣与不辣都有，含精确配比和做法），支持关键词搜索、分类筛选、随机推荐、收藏、标记做过、买菜清单、按食材找菜、自定义拿手菜，两人数据通过 GitHub 自动同步。纯静态网页，微信里点开即用，0 费用。

## 菜谱数据来源

- **📖 实测做法（12 道）**：来自开源项目「程序员做饭指南」[Anduin2017/HowToCook](https://github.com/Anduin2017/HowToCook)（GitHub 4000+ star，社区 1000+ 贡献者维护），配比精确到克/毫升、步骤含时间与火候、附注意事项，可放心照做
- **🌶️ 湘菜精选（5 道）**：辣椒炒肉、毛氏红烧肉、湘味孜然土豆片等湖南辣味菜
- **🍚 家常精选（33 道）**：常见家常炒菜补充

每道菜卡片和详情页都有来源标签，一眼可辨。辣菜 20 道、不辣 30 道，可在口味筛选里选择。

## 一、部署到 GitHub Pages（一次部署，永久使用）

1. 在 GitHub 上新建一个仓库（名字随意，如 `zycp`，勾选 Public 或 Private 都可以）
2. 在项目文件夹打开终端，执行：

```bash
git init
git add .
git commit -m "init"
git branch -M main
git remote add origin https://github.com/你的用户名/zycp.git
git push -u origin main
```

3. 网页操作：进入仓库 → Settings → Pages → 在 Build and deployment 的 Source 选 `Deploy from a branch`，Branch 选 `main` 和 `/ (root)` → Save
4. 等 1-2 分钟后访问 `https://你的用户名.github.io/zycp/`，用微信打开这个链接，就是你们的专属菜谱应用
5. 想让两人更好找：把链接发到微信聊天里，右上角「···」→ 添加到桌面，或者置顶聊天

## 二、云端同步配置（两人共享收藏/做过记录）

同步数据存在你自己的 GitHub 私有 gist 里，免费、安全。**只需生成一个令牌（5分钟）：**

1. 打开 https://github.com/settings/tokens → 点 **Generate new token** → **Generate new token (classic)**
2. 名字随意（如 `zycp`），有效期自己定，在权限列表勾选 **`gist`** 一项即可
3. 拉到最下点 **Generate token**，复制生成的令牌（`ghp_` 开头，只显示一次，马上复制）
4. 用微信打开应用 → 「我的」页 → 云端同步 → 粘贴令牌 → 点 **保存并同步**
5. 首次同步会自动在你的 GitHub 建一个私有 gist 存数据，之后两人自动互相同步

女朋友那边用微信打开应用，填同一个令牌即可（两人共用一个令牌，操作相同）。

## 三、本地预览（可选）

```bash
cd 项目目录
npx serve .
```

浏览器打开提示的地址即可。

## 四、文件说明

| 文件 | 说明 |
|---|---|
| index.html | 页面结构 |
| styles.css | 样式（深浅色模式） |
| app.js | 全部交互逻辑 + GitHub Gist 云端同步 |
| recipes-data.js | 50 道内置菜谱数据（想加菜可改这里） |

## 常见问题

- **同步失败**：检查令牌是否正确、是否勾选了 gist 权限；网络访问 GitHub 较慢时耐心等待几秒重试
- **数据安全**：数据存在各自手机本地 + 你的 GitHub 私有 gist，令牌只存放在手机本地
- **想换设备/重新配置**：填同样的令牌即可拉回云端数据
- **想删数据**：「我的」页有清空本地数据按钮
