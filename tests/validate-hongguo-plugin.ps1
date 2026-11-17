$ErrorActionPreference = 'Stop'

$pluginPath = Join-Path $PSScriptRoot '../Plugin/红果短剧去广告.plugin'

if (-not (Test-Path -LiteralPath $pluginPath)) {
    throw "插件文件不存在：$pluginPath"
}

$content = Get-Content -LiteralPath $pluginPath -Raw -Encoding UTF8

# 按插件中 DOMAIN 和 DOMAIN-SUFFIX 的匹配范围检查连播样例。
$rules = [regex]::Match($content, '(?ms)^\[Rule\]\s*$(.*?)(?=^\[|\z)').Groups[1].Value
$domainCases = @{
    'v5-reading-ad.qznovelvod.com' = $true
    'v5-se-sjy-daily-reading-ad.qznovelvod.com' = $true
    'v96-reading-ad.qznovelvod.com' = $true
    'ads3-normal-lq.zijieapi.com' = $true
    'ads5-normal-lf.zijieapi.com' = $true
    'v5-reading-video.qznovelvod.com' = $false
    'v5-se-sjy-daily-reading-video.qznovelvod.com' = $false
    'qznovelvod.com' = $false
    'api3-normal.fqnovel.com' = $false
    'p3-novel-sign.byteimg.com' = $false
    'api3-normal-lq.zijieapi.com' = $false
}

foreach ($domain in $domainCases.Keys) {
    $blocked = $false
    foreach ($line in $rules -split '\r?\n') {
        if ($line -match '^DOMAIN,([^,]+),REJECT$' -and $domain -eq $Matches[1]) {
            $blocked = $true
            break
        }
        if ($line -match '^DOMAIN-SUFFIX,([^,]+),REJECT$') {
            if ($domain -eq $Matches[1] -or $domain.EndsWith('.' + $Matches[1])) {
                $blocked = $true
                break
            }
        }
    }
    if ($blocked -ne $domainCases[$domain]) {
        throw "域名规则不符合预期：$domain，预期拦截=$($domainCases[$domain])，实际拦截=$blocked"
    }
}

$requiredPatterns = @(
    '(?m)^#!name\s*=\s*红果短剧去广告\s*$',
    '(?m)^\[Rule\]\s*$',
    '(?m)^DOMAIN-SUFFIX,pangolin-sdk-toutiao\.com,REJECT\s*$',
    '(?m)^DOMAIN-SUFFIX,pglstatp-toutiao\.com,REJECT\s*$',
    '(?m)^DOMAIN,p6-ad-sign\.byteimg\.com,REJECT\s*$',
    '(?m)^DOMAIN,p9-ad-sign\.byteimg\.com,REJECT\s*$',
    '(?m)^\[Rewrite\]\s*$',
    '(?m)^\^https\?://api\[35\]-normal\(\?:-hl\)\?\\\.fqnovel\\\.com/luckycat/ reject\s*$',
    '(?m)^\[MITM\]\s*$',
    '(?m)^hostname = api3-normal\.fqnovel\.com,api3-normal-hl\.fqnovel\.com,api5-normal\.fqnovel\.com,api5-normal-hl\.fqnovel\.com\s*$',
    '(?m)^DOMAIN-SUFFIX,luckycat\.byteug\.com,REJECT\s*$'
)

foreach ($pattern in $requiredPatterns) {
    if ($content -notmatch $pattern) {
        throw "插件缺少必要配置：$pattern"
    }
}

# 这些宽泛规则会误伤红果短剧的正片、封面或通用业务接口，插件中不允许出现。
$forbiddenPatterns = @(
    '(?m)^DOMAIN-SUFFIX,bytedance\.com,REJECT',
    '(?m)^DOMAIN-SUFFIX,byteimg\.com,REJECT',
    '(?m)^DOMAIN-SUFFIX,snssdk\.com,REJECT',
    '(?m)^DOMAIN,i\.snssdk\.com,REJECT',
    '(?m)^DOMAIN(?:-SUFFIX)?,[^\r\n]*(fqnovelvod|novelapp\.ixigua)\.com,REJECT',
    '(?m)^\s*/mp4\s+',
    '(?m)^IP-CIDR,'
)

foreach ($pattern in $forbiddenPatterns) {
    if ($content -match $pattern) {
        throw "插件包含高误伤风险配置：$pattern"
    }
}

Write-Host '红果短剧 Loon 插件静态校验通过。'

