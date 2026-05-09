FROM alpine:3.19
RUN apk add --no-cache pgbouncer && \
    addgroup -S -g 1001 pgbouncergroup && \
    adduser -S -u 1001 -G pgbouncergroup pgbouncer && \
    mkdir -p /etc/pgbouncer && \
    chown -R pgbouncer:pgbouncergroup /etc/pgbouncer
USER 1001
EXPOSE 5432
ENTRYPOINT ["pgbouncer"]
CMD ["/etc/pgbouncer/pgbouncer.ini"]
