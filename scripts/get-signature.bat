@echo off
chcp 65001 >nul

echo === 获取 Release Keystore 签名 ===
echo.

set KEYTOOL="C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe"
if "%KEYSTORE_PATH%"=="" (set "KEYSTORE=android\app\release.keystore") else (set "KEYSTORE=%KEYSTORE_PATH%")
if "%KEYSTORE_PASSWORD%"=="" (
    echo 错误：请先配置 KEYSTORE_PASSWORD
    exit /b 1
)
if "%KEY_ALIAS%"=="" set "KEY_ALIAS=waylog"
set "STOREPASS=%KEYSTORE_PASSWORD%"

echo Keystore 文件: %KEYSTORE%
echo 密钥别名: %KEY_ALIAS%
echo.

echo === 签名信息 ===
echo.

%KEYTOOL% -list -v -keystore %KEYSTORE% -storepass %STOREPASS% -alias %KEY_ALIAS% 2>nul | findstr /C:"SHA1" /C:"SHA256" /C:"MD5"

echo.
echo === 微信开放平台配置 ===
echo.

echo 微信开放平台需要的签名格式（小写，无冒号）：
echo.

for /f "tokens=2" %%a in ('%KEYTOOL% -list -v -keystore %KEYSTORE% -storepass %STOREPASS% -alias %KEY_ALIAS% 2^>nul ^| findstr /C:"SHA1"') do (
    set SHA1=%%a
    call :FormatSHA1
)

goto :End

:FormatSHA1
set SHA1_FORMATTED=%SHA1::=%
set SHA1_FORMATTED=%SHA1_FORMATTED: =%
echo SHA1 签名（微信平台用）: %SHA1_FORMATTED%
echo.
echo 请将此签名配置到微信开放平台：
echo 1. 登录 https://open.weixin.qq.com/
echo 2. 进入移动应用管理
echo 3. 修改应用签名
echo 4. 粘贴上面的 SHA1 签名
goto :eof

:End
echo.
echo === 阿里云配置 ===
echo.
echo 阿里云短信服务也需要配置相同的签名
echo 请登录阿里云控制台更新包签名
echo.
pause
