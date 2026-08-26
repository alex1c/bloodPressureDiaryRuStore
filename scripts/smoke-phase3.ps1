$ErrorActionPreference = 'Stop'
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
$serial = 'emulator-5554'
$tmp = 'D:\petProject\bloodPressureDiaryRuStore'

function Get-UiXml([string]$name) {
	& $adb -s $serial shell uiautomator dump "/sdcard/$name.xml" | Out-Null
	& $adb -s $serial pull "/sdcard/$name.xml" "$tmp\.tmp-$name.xml" | Out-Null
	return [System.Text.Encoding]::UTF8.GetString(
		[System.IO.File]::ReadAllBytes("$tmp\.tmp-$name.xml")
	)
}

function Show-Texts([string]$xml) {
	[regex]::Matches($xml, 'text="([^"]{2,})"') | ForEach-Object {
		Write-Host ('TEXT: ' + $_.Groups[1].Value)
	}
}

function Find-BoundsByRegex([string]$xml, [string]$regex) {
	$m = [regex]::Match($xml, $regex)
	if (-not $m.Success) {
		return $null
	}
	return @{
		X = [int]((([int]$m.Groups[1].Value) + ([int]$m.Groups[3].Value)) / 2)
		Y = [int]((([int]$m.Groups[2].Value) + ([int]$m.Groups[4].Value)) / 2)
	}
}

function Tap-Point($p) {
	Write-Host ("TAP " + $p.X + "," + $p.Y)
	& $adb -s $serial shell input tap $p.X $p.Y
}

Write-Host '=== HOME ==='
$xml = Get-UiXml 'smoke1'
Show-Texts $xml

# Button label contains "измерение" / Add measurement — match accessibility or button text via Unicode
$add = Find-BoundsByRegex $xml 'text="[^"]*[Dd]oba[^"]*"|content-desc="[^"]*izmer[^"]*"'
# Prefer exact UTF-8 search constructed in code
$addLabel = [string]::Concat(
	[char]0x0414, [char]0x043E, [char]0x0431, [char]0x0430, [char]0x0432, [char]0x0438, [char]0x0442, [char]0x044C,
	' ',
	[char]0x0438, [char]0x0437, [char]0x043C, [char]0x0435, [char]0x0440, [char]0x0435, [char]0x043D, [char]0x0438, [char]0x0435
)
$pattern = 'text="' + [regex]::Escape($addLabel) + '"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"'
$add = Find-BoundsByRegex $xml $pattern
if (-not $add) {
	$pattern = 'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*text="' + [regex]::Escape($addLabel) + '"'
	$add = Find-BoundsByRegex $xml $pattern
}
if (-not $add) { throw 'Add button not found' }
Tap-Point $add
Start-Sleep -Seconds 2

Write-Host '=== FORM ==='
$xml = Get-UiXml 'smoke2'
Show-Texts $xml

$inputs = [regex]::Matches($xml, 'class="android.widget.EditText"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"')
if ($inputs.Count -lt 3) {
	$inputs = [regex]::Matches($xml, 'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*class="android.widget.EditText"')
}
Write-Host ("EditText count=" + $inputs.Count)
if ($inputs.Count -lt 3) { throw 'Expected at least 3 EditText fields' }

function Tap-Match($m) {
	$p = @{
		X = [int]((([int]$m.Groups[1].Value) + ([int]$m.Groups[3].Value)) / 2)
		Y = [int]((([int]$m.Groups[2].Value) + ([int]$m.Groups[4].Value)) / 2)
	}
	Tap-Point $p
	Start-Sleep -Milliseconds 400
}

Tap-Match $inputs[0]
& $adb -s $serial shell input text '128'
Start-Sleep -Milliseconds 300
Tap-Match $inputs[1]
& $adb -s $serial shell input text '82'
Start-Sleep -Milliseconds 300
Tap-Match $inputs[2]
& $adb -s $serial shell input text '71'
Start-Sleep -Milliseconds 300
& $adb -s $serial shell input keyevent 4
Start-Sleep -Milliseconds 600

$xml = Get-UiXml 'smoke3'
$saveLabel = [string]::Concat(
	[char]0x0421, [char]0x043E, [char]0x0445, [char]0x0440, [char]0x0430, [char]0x043D, [char]0x0438, [char]0x0442, [char]0x044C
)
$pattern = 'text="' + [regex]::Escape($saveLabel) + '"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"'
$save = Find-BoundsByRegex $xml $pattern
if (-not $save) {
	$pattern = 'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*text="' + [regex]::Escape($saveLabel) + '"'
	$save = Find-BoundsByRegex $xml $pattern
}
if (-not $save) { throw 'Save button not found' }
Tap-Point $save
Start-Sleep -Seconds 3

Write-Host '=== AFTER SAVE ==='
$xml = Get-UiXml 'smoke4'
Show-Texts $xml
if ($xml -notmatch '128') { throw 'Saved measurement not visible' }
Write-Host 'SMOKE_CREATE_OK'

# Open latest by tapping 128 / 82 row text
$pattern = 'text="128 / 82"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"'
$open = Find-BoundsByRegex $xml $pattern
if (-not $open) {
	$pattern = 'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*text="128 / 82"'
	$open = Find-BoundsByRegex $xml $pattern
}
if (-not $open) { throw 'Saved row not tappable' }
Tap-Point $open
Start-Sleep -Seconds 2

Write-Host '=== EDIT ==='
$xml = Get-UiXml 'smoke5'
Show-Texts $xml
$inputs = [regex]::Matches($xml, 'class="android.widget.EditText"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"')
if ($inputs.Count -lt 3) {
	$inputs = [regex]::Matches($xml, 'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*class="android.widget.EditText"')
}
Tap-Match $inputs[0]
& $adb -s $serial shell input keyevent 123
& $adb -s $serial shell input keyevent --keycode KEYCODE_MOVE_END
# clear via select-all is flaky; overwrite by many deletes
1..5 | ForEach-Object { & $adb -s $serial shell input keyevent 67 }
& $adb -s $serial shell input text '132'
& $adb -s $serial shell input keyevent 4
Start-Sleep -Milliseconds 400
$xml = Get-UiXml 'smoke6'
$save = Find-BoundsByRegex $xml ('text="' + [regex]::Escape($saveLabel) + '"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"')
if (-not $save) {
	$save = Find-BoundsByRegex $xml ('bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*text="' + [regex]::Escape($saveLabel) + '"')
}
Tap-Point $save
Start-Sleep -Seconds 3

$xml = Get-UiXml 'smoke7'
Show-Texts $xml
if ($xml -notmatch '132') { throw 'Edited measurement not visible' }
Write-Host 'SMOKE_EDIT_OK'

# reopen and delete
$open = Find-BoundsByRegex $xml 'text="132 / 82"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"'
if (-not $open) {
	$open = Find-BoundsByRegex $xml 'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*text="132 / 82"'
}
Tap-Point $open
Start-Sleep -Seconds 2
$xml = Get-UiXml 'smoke8'
$delLabel = [string]::Concat(
	[char]0x0423, [char]0x0434, [char]0x0430, [char]0x043B, [char]0x0438, [char]0x0442, [char]0x044C,
	' ',
	[char]0x0438, [char]0x0437, [char]0x043C, [char]0x0435, [char]0x0440, [char]0x0435, [char]0x043D, [char]0x0438, [char]0x0435
)
$del = Find-BoundsByRegex $xml ('text="' + [regex]::Escape($delLabel) + '"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"')
if (-not $del) {
	$del = Find-BoundsByRegex $xml ('bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*text="' + [regex]::Escape($delLabel) + '"')
}
if (-not $del) { throw 'Delete button not found' }
Tap-Point $del
Start-Sleep -Seconds 1

# confirm dialog button "Удалить"
$xml = Get-UiXml 'smoke9'
$confirm = [string]::Concat(
	[char]0x0423, [char]0x0434, [char]0x0430, [char]0x043B, [char]0x0438, [char]0x0442, [char]0x044C
)
$btn = Find-BoundsByRegex $xml ('text="' + [regex]::Escape($confirm) + '"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"')
if (-not $btn) {
	$btn = Find-BoundsByRegex $xml ('bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*text="' + [regex]::Escape($confirm) + '"')
}
if (-not $btn) { throw 'Delete confirm not found' }
Tap-Point $btn
Start-Sleep -Seconds 3

$xml = Get-UiXml 'smoke10'
Show-Texts $xml
if ($xml -match '132 / 82') { throw 'Measurement still present after delete' }
Write-Host 'SMOKE_DELETE_OK'

# restart persistence check: recreate one, force-stop, relaunch
$xml = Get-UiXml 'smoke11'
$add = Find-BoundsByRegex $xml ('text="' + [regex]::Escape($addLabel) + '"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"')
if (-not $add) {
	$add = Find-BoundsByRegex $xml ('bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*text="' + [regex]::Escape($addLabel) + '"')
}
if (-not $add) { throw 'Add button missing after delete' }
Tap-Point $add
Start-Sleep -Seconds 2
$xml = Get-UiXml 'smoke12'
$inputs = [regex]::Matches($xml, 'class="android.widget.EditText"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"')
if ($inputs.Count -lt 3) {
	$inputs = [regex]::Matches($xml, 'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*class="android.widget.EditText"')
}
Tap-Match $inputs[0]; & $adb -s $serial shell input text '140'
Tap-Match $inputs[1]; & $adb -s $serial shell input text '90'
Tap-Match $inputs[2]; & $adb -s $serial shell input text '75'
& $adb -s $serial shell input keyevent 4
Start-Sleep -Milliseconds 400
$xml = Get-UiXml 'smoke13'
$save = Find-BoundsByRegex $xml ('text="' + [regex]::Escape($saveLabel) + '"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"')
if (-not $save) {
	$save = Find-BoundsByRegex $xml ('bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*text="' + [regex]::Escape($saveLabel) + '"')
}
Tap-Point $save
Start-Sleep -Seconds 2

& $adb -s $serial shell am force-stop com.calculatorplatform.bpdiary
Start-Sleep -Seconds 1
$url = 'exp+bp-diary://expo-development-client/?url=' + [uri]::EscapeDataString('http://127.0.0.1:8082')
& $adb -s $serial shell am start -a android.intent.action.VIEW -d $url
Start-Sleep -Seconds 8
# dismiss menus if any
$xml = Get-UiXml 'smoke14'
if ($xml -match 'Continue') {
	$c = Find-BoundsByRegex $xml 'text="Continue"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"'
	if ($c) { Tap-Point $c; Start-Sleep -Seconds 3; $xml = Get-UiXml 'smoke15' }
}
if ($xml -match 'content-desc="Close"') {
	$c = Find-BoundsByRegex $xml 'content-desc="Close"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"'
	if ($c) { Tap-Point $c; Start-Sleep -Seconds 2; $xml = Get-UiXml 'smoke16' }
}
Show-Texts $xml
if ($xml -notmatch '140') { throw 'Measurement missing after restart' }
Write-Host 'SMOKE_RESTART_OK'
Write-Host 'SMOKE_PHASE3_PASS'
