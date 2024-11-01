// ConfigForm.tsx
import React from "react";
import {
  TextField,
  Button,
  Typography,
  Container,
  Snackbar,
  Alert,
  InputAdornment,
} from "@mui/material";
import ApiIcon from "@mui/icons-material/Api";
import PublicIcon from "@mui/icons-material/Public";
import LinkIcon from "@mui/icons-material/Link";
import PawIcon from "./PawIcon";

interface Config {
  apiKey: string;
  backendUrl: string;
  frontendUrl: string;
}

interface ConfigFormProps {
  initialConfig: Config;
  onSubmit: (config: Config) => void;
}

const ConfigForm: React.FC<ConfigFormProps> = ({ initialConfig, onSubmit }) => {
  const [apiKey, setApiKey] = React.useState(initialConfig.apiKey);
  const [backendUrl, setBackendUrl] = React.useState(initialConfig.backendUrl);
  const [frontendUrl, setFrontendUrl] = React.useState(
    initialConfig.frontendUrl
  );
  const [snackbarOpen, setSnackbarOpen] = React.useState(false);
  const [snackbarMessage, setSnackbarMessage] = React.useState("");
  const [snackbarSeverity, setSnackbarSeverity] = React.useState<
    "success" | "error"
  >("success");

  // 当 initialConfig 更新时，更新表单状态
  React.useEffect(() => {
    setApiKey(initialConfig.apiKey);
    setBackendUrl(initialConfig.backendUrl);
    setFrontendUrl(initialConfig.frontendUrl);
  }, [initialConfig]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!apiKey || !backendUrl || !frontendUrl) {
      setSnackbarMessage("请填写所有字段");
      setSnackbarSeverity("error");
      setSnackbarOpen(true);
      return;
    }

    onSubmit({ apiKey, backendUrl, frontendUrl });
    setSnackbarMessage("配置已保存");
    setSnackbarSeverity("success");
    setSnackbarOpen(true);
  };

  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  return (
    <Container maxWidth="sm" sx={{ padding: "20px" }}>
      <div
        style={{ display: "flex", alignItems: "center", marginBottom: "20px" }}
      >
        <PawIcon />
        <Typography variant="h4" align="center" gutterBottom>
          配置 PawSQL
        </Typography>
      </div>
      <form onSubmit={handleSubmit}>
        <TextField
          fullWidth
          label="API Key"
          variant="outlined"
          margin="normal"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <ApiIcon />
              </InputAdornment>
            ),
          }}
        />
        <TextField
          fullWidth
          label="Backend URL"
          variant="outlined"
          margin="normal"
          value={backendUrl}
          onChange={(e) => setBackendUrl(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <PublicIcon />
              </InputAdornment>
            ),
          }}
        />
        <TextField
          fullWidth
          label="Frontend URL"
          variant="outlined"
          margin="normal"
          value={frontendUrl}
          onChange={(e) => setFrontendUrl(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <LinkIcon />
              </InputAdornment>
            ),
          }}
        />
        <Button
          type="submit"
          variant="contained"
          color="primary"
          fullWidth
          sx={{ marginTop: "16px" }}
        >
          保存配置
        </Button>
      </form>
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
      >
        <Alert
          onClose={handleSnackbarClose}
          severity={snackbarSeverity}
          sx={{ width: "100%" }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default ConfigForm;
