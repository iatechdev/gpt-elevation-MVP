# ES-13 · PR #65 · head 5bbd8c5 · QA-Claude
Dockerfile +3 líneas. Build de Vite con la variable sin definir, vacía, false, TRUE, 1 y con espacios: bundle idéntico (818542 bytes), sin la entrada de la Brújula. Con true: aparece (819321 bytes). tsc sin errores; frontend 156/156. No verificado: docker build real, staging.
