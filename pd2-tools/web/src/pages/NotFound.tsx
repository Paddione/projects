import { Button, Center, Stack, Text, Title } from "@mantine/core";

export default function NotFound() {
  return (
    <Center style={{ minHeight: "100vh" }}>
      <Stack align="center" gap="xl">
        <Stack align="center" gap="xs">
          <Title order={1} size={120} c="dimmed" style={{ lineHeight: 1 }}>
            404
          </Title>
          <Title order={2} size="h2">
            Page Not Found
          </Title>
          <Text c="dimmed" size="lg" ta="center" maw={500}>
            The page you are looking for doesn't exist or has been moved.
          </Text>
        </Stack>
        <Button component="a" href="/" size="md">
          Return to Home
        </Button>
      </Stack>
    </Center>
  );
}
