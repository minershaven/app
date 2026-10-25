ARG MININGCORE_REF=a553f62301f44c6df80891e408b6526d1dd98692

FROM alpine/git:2.47.2 AS source
ARG MININGCORE_REF
RUN git clone https://github.com/oliverw/miningcore.git /src \
    && git -C /src checkout --detach "$MININGCORE_REF"

FROM mcr.microsoft.com/dotnet/sdk:6.0-jammy AS build
RUN apt-get update && apt-get install -y --no-install-recommends \
    cmake build-essential libssl-dev pkg-config libboost-all-dev libsodium-dev \
    libzmq5 libzmq3-dev golang-go \
    && rm -rf /var/lib/apt/lists/*
COPY --from=source /src /src
WORKDIR /src/src/Miningcore
RUN dotnet publish -c Release --framework net6.0 -o /out

FROM mcr.microsoft.com/dotnet/aspnet:6.0-jammy AS miningcore
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 libzmq5 libsodium23 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /out ./
COPY config.template.json /app/config.template.json
COPY render_config.py /app/render_config.py
COPY entrypoint.sh /app/entrypoint.sh
RUN useradd --system --uid 10001 --home-dir /app miningcore \
    && chown -R miningcore:miningcore /app \
    && chmod 0555 /app/entrypoint.sh
USER miningcore
ENTRYPOINT ["/app/entrypoint.sh"]

FROM postgres:16 AS postgres
COPY --from=source /src/src/Miningcore/Persistence/Postgres/Scripts/createdb.sql /docker-entrypoint-initdb.d/10-miningcore.sql