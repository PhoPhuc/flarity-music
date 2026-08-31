!macro customInit
  ; Tu dong dong tien trinh cu neu dang mo de cho phep cai de khong bi loi file lock
  nsExec::Exec 'taskkill /F /IM musicccc.exe'
  nsExec::Exec 'taskkill /F /IM flarity-music.exe'
  Sleep 500
!macroend
