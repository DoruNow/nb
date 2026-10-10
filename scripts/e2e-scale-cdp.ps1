$ErrorActionPreference = "Stop"

function Connect-Cdp([string]$WsUrl) {
  $ws = New-Object System.Net.WebSockets.ClientWebSocket
  $ct = [Threading.CancellationToken]::None
  $ws.ConnectAsync([Uri]$WsUrl, $ct).Wait()
  $state = @{ Id = 0; Ws = $ws; Buf = New-Object byte[] 1048576; Ct = $ct }
  return $state
}

function Send-Cdp($state, [string]$Method, $Params) {
  $state.Id++
  $payload = @{ id = $state.Id; method = $Method }
  if ($null -ne $Params) { $payload.params = $Params }
  $json = ($payload | ConvertTo-Json -Compress -Depth 30)
  $bytes = [Text.Encoding]::UTF8.GetBytes($json)
  $state.Ws.SendAsync(
    [ArraySegment[byte]]::new($bytes),
    [Net.WebSockets.WebSocketMessageType]::Text,
    $true,
    $state.Ct
  ).Wait()
  while ($true) {
    $result = $state.Ws.ReceiveAsync(
      [ArraySegment[byte]]::new($state.Buf),
      $state.Ct
    ).Result
    $text = [Text.Encoding]::UTF8.GetString($state.Buf, 0, $result.Count)
    $msg = $text | ConvertFrom-Json
    if ($msg.id -eq $state.Id) { return $msg }
  }
}

$ver = Invoke-RestMethod http://127.0.0.1:9334/json/version
$browser = Connect-Cdp $ver.webSocketDebuggerUrl
$created = Send-Cdp $browser "Target.createTarget" @{ url = "http://127.0.0.1:5173/e2e" }
$targetId = $created.result.targetId
Start-Sleep -Seconds 2
$pages = Invoke-RestMethod http://127.0.0.1:9334/json/list
$page = $pages | Where-Object { $_.id -eq $targetId } | Select-Object -First 1
if (-not $page) {
  $page = $pages | Where-Object { $_.url -like "*5173*" } | Select-Object -First 1
}
$session = Connect-Cdp $page.webSocketDebuggerUrl
[void](Send-Cdp $session "Page.enable" $null)
[void](Send-Cdp $session "Runtime.enable" $null)
Start-Sleep -Seconds 4

$expr = @'
(async () => {
  const root = document.querySelector("#proportional-scale");
  if (!root) return { err: "missing #proportional-scale" };
  root.scrollIntoView();
  await new Promise((r) => setTimeout(r, 3000));
  const read = () => ({
    result: document.querySelector(".scale-result")?.textContent?.trim() ?? "",
    hint: document.querySelector(".scale-panel .hint")?.textContent?.trim() ?? "",
    parts: [...document.querySelectorAll(".scale-parts li")].map((li) =>
      li.textContent.trim(),
    ),
    boxes: [...document.querySelectorAll("#proportional-scale .fit")].map((el) => {
      const r = el.getBoundingClientRect();
      return { w: +r.width.toFixed(1), h: +r.height.toFixed(1) };
    }),
  });
  const first = read();
  const input = root.querySelector('input[type="number"]');
  if (input) {
    input.value = "145";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 2500));
  }
  const second = read();
  return { v141: first, v145: second };
})()
'@

$eval = Send-Cdp $session "Runtime.evaluate" @{
  expression = $expr
  awaitPromise = $true
  returnByValue = $true
}
$eval.result.result.value | ConvertTo-Json -Depth 12
