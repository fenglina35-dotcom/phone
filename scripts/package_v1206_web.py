"""Archive committed static website files without private projects or tool state."""
from hashlib import sha256
from io import BytesIO
from pathlib import Path, PurePosixPath
from zipfile import ZipFile, ZIP_DEFLATED
from urllib.parse import unquote, urlsplit
import json
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT.parent / '小手机_v1206_网页版_昵称提示与自定义衣柜.zip'
NAME = 'SmallPhone_v1206_Web'

def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT)

assert not git('status', '--porcelain').strip(), 'Commit first; worktree must be clean'
assert git('branch', '--show-current').decode().strip() == 'main'
assert not OUTPUT.exists(), 'Never overwrite an existing package'
head = git('rev-parse', 'HEAD').decode().strip()
tracked = git('ls-files', '-z').decode('utf-8').split('\0')
extensions = {'.html', '.js', '.css', '.json', '.png', '.jpg', '.jpeg', '.webp',
              '.gif', '.svg', '.ico', '.mp3', '.wav', '.m4a', '.mp4', '.webm',
              '.ogg', '.woff', '.woff2', '.ttf', '.otf'}
top = [s for s in tracked if s and '/' not in s and
       (PurePosixPath(s).suffix.lower() in extensions or s in {'CNAME', '.nojekyll'})]
dirs = [d for d in ['assets', 'games', 'vendor', 'admin'] if any(s.startswith(d+'/') for s in tracked)]
archive = ZipFile(BytesIO(git('-c', 'core.autocrlf=false', 'archive', '--format=zip', 'HEAD', '--', *top, *dirs)))
files = {i.filename: archive.read(i) for i in archive.infolist() if not i.is_dir()}
assert all(not s.startswith(('native/', 'scripts/', 'tests/', 'docs/', 'supabase/', 'services/')) for s in files)
for s in tracked:
    if s.startswith('games/pixel-home/'):
        assert s in files, 'Missing game resource '+s
shell = files['小手机.html'].decode('utf-8')
assert "__NORTH_SHELL_BUILD__='1206'" in shell
assert 'app.js?v=1206' in shell
assert "APP_VER='v1206" in files['app.js'].decode('utf-8')
assert "const BUILD='1206'" in files['sw.js'].decode('utf-8')
assert '小手机.html?v=1206' in files['index.html'].decode('utf-8')
game = files['games/pixel-home/game.js'].decode('utf-8')
assert "const arrangingText='等待'+" in game and 'step(arrangingText);' in game
assert '等待角色安排' not in game
assert 'function roleWardrobe(' in files['pixel-home-policy.js'].decode('utf-8')
assert 'savedOutfits' in files['games/pixel-home/wardrobe/app.js'].decode('utf-8')
assert 'pixel-wardrobe-info.js?v=1206' in shell
# Check every local script/style reference from every HTML entry in the bundle.
for name, data in files.items():
    if not name.endswith('.html'):
        continue
    for link in re.findall(r'(?:src|href)=["\']([^"\']+)["\']', data.decode('utf-8')):
        u = urlsplit(link)
        if u.scheme or u.netloc or not u.path.endswith(('.js', '.css')):
            continue
        import posixpath
        target = posixpath.normpath(posixpath.join(str(PurePosixPath(name).parent), unquote(u.path)))
        assert target in files, f'{name} references missing {target}'
catalog = json.loads(files['games/pixel-home/wardrobe/catalog.json'])
for name, digest in catalog['files'].items():
    assert sha256(files['games/pixel-home/wardrobe/'+name]).hexdigest() == digest, name
files['SOURCE_COMMIT.txt'] = f'commit={head}\nversion=v1206\nworktree=clean\nweb-push=not-attempted\n'.encode()
files['网页版使用说明.md'] = '''# v1206 网页版

将本文件夹的内容部署到原静态网站目录，入口为index.html；完整保留assets、games、vendor等子目录。
请使用HTTP(S)访问，直接双击本地HTML不能替代正式网页运行环境。
保留原网站域名和已有用户存档，不需要清空浏览器数据。
等待照顾安排时显示绑定角色昵称；自定义衣柜、早晚角色穿搭及已调参数均保留。
本包不包含私人Xcode工程；私人版另有iOS327源码ZIP。此包生成不代表已经推送线上。
'''.encode('utf-8')
files['SHA256SUMS.json'] = json.dumps({s: sha256(b).hexdigest() for s, b in sorted(files.items())}, ensure_ascii=False, indent=2).encode('utf-8')
with ZipFile(OUTPUT, 'x', ZIP_DEFLATED, compresslevel=9) as z:
    for name, data in sorted(files.items()):
        z.writestr(NAME+'/'+name, data)
with ZipFile(OUTPUT) as z:
    assert z.testzip() is None
    for name, data in files.items():
        assert z.read(NAME+'/'+name) == data
print('ZIP='+str(OUTPUT))
print('COMMIT='+head)
print('FILES='+str(len(files)))
print('SIZE='+str(OUTPUT.stat().st_size))
print('SHA256='+sha256(OUTPUT.read_bytes()).hexdigest().upper())

