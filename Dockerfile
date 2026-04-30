# Usamos una imagen base ligera de Nginx (Alpine Linux)
FROM nginx:alpine

# Copiamos nuestra configuración personalizada de Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiamos todos los archivos estáticos del proyecto
COPY . /usr/share/nginx/html

# Exponemos el puerto 8080 (Esperado por Cloud Run)
EXPOSE 8080

# Comando por defecto para iniciar Nginx
CMD ["nginx", "-g", "daemon off;"]