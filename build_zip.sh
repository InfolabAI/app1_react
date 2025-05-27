rm app_project_backup.zip
zip -r app_project_backup.zip . -x "MyApp_RN_New/android/app/build/*"
scp app_project_backup.zip hee@192.168.0.2:~
