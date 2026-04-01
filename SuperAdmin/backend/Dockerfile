FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY SuperAdmin.API/SuperAdmin.API.csproj SuperAdmin.API/
RUN dotnet restore SuperAdmin.API/SuperAdmin.API.csproj
COPY . .
RUN dotnet publish SuperAdmin.API/SuperAdmin.API.csproj -c Release -o /app/out

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /app/out .
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
ENTRYPOINT ["dotnet", "SuperAdmin.API.dll"]
