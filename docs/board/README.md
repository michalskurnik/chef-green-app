# לוח המשימות של השף הירוק - מבנה ונהלים

הלוח: https://claude.ai/artifact/11J6qUvw8fUy4PR5vQR3J1
עותק חי (מתעדכן מהלוח): https://docs.google.com/document/d/1hAv4ZIzJrf3yo7iLHEVaADX-R0PFy7Jc4ZW8O-WrrSk
גיבויים: docs/board-backup/ ותיקיית הדרייב "גיבוי לוח התיקונים - השף הירוק".

## איפה הנתונים
- מקור: מסד הנתונים של הארטיפקט (collections: items, releases, log). נגיש מסשן של Claude דרך הכלי ArtifactData.
- עותק מלא מוטמע בכל גרסה של הדף (script#seed), והדף מפרסם את עצמו מחדש אחרי כל שינוי.
- עותק טקסט חי ב-Google Docs, מתעדכן אחרי כל שינוי כשהלוח פתוח אצל הבעלים (רועי).

## מבנה
releases/<id>: name, status (planned | active | released | archived), order, build, targetDate, releasedAt, notes, createdAt, updatedAt

items/<id>:
- num - מספר קבוע (המפתח GC-num)
- type - bug | feedback | task | improvement | request
- release - מזהה גרסה, או ריק = ללא גרסה
- status - new (לטיפול) | approved (מאושר) | doing (בעבודה) | fixed (לבדיקה) | closed (הושלם) | wont (לא נבצע)
- sev - 1 חוסם, 2 גבוה, 3 בינוני, 4 נמוך
- owner - none | roy | michal
- title, desc, note, labels[], pkg, screen, device, source, reporters, due (YYYY-MM-DD), archived, files[]
- בקשות (type=request): answer, answeredAt, answeredBy. בקשה בלי תשובה מופיעה ב"ממתין לתשובה".
- createdAt, updatedAt (ISO, UTC, אמיתי - לא בעתיד)

log/<id>: at, who, action, key, title, details, itemId

## נהלים לסשן של Claude
- לקרוא: ArtifactData list על items, releases, log.
- לכתוב: batch עם if_version, ותמיד updatedAt בזמן הנוכחי. להוסיף רשומת log עם who="Claude".
- אחרי שינוי מסשן: לפרסם מחדש את הדף עם העותק המוטמע המעודכן, ולעדכן את העותק ב-Google Docs.
- גרסה חדשה: כפתור "+ גרסה" בלוח (עם תבנית בקשות וצ'קליסט שחרור), או set ל-releases.
