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
import ApiIcon from "@mui/icons-material/Api"; // API Key 图标
import PublicIcon from "@mui/icons-material/Public"; // URL 图标
import LinkIcon from "@mui/icons-material/Link"; // 链接图标
import PawIcon from "./PawIcon"; // 引入 PawIcon 组件

interface ConfigFormProps {
  onSubmit: (config: {
    apiKey: string;
    backendUrl: string;
    frontendUrl: string;
  }) => void;
}

const ConfigForm: React.FC<ConfigFormProps> = ({ onSubmit }) => {
  const [apiKey, setApiKey] = React.useState("");
  const [backendUrl, setBackendUrl] = React.useState("");
  const [frontendUrl, setFrontendUrl] = React.useState("");
  const [snackbarOpen, setSnackbarOpen] = React.useState(false);
  const [snackbarMessage, setSnackbarMessage] = React.useState("");
  const [snackbarSeverity, setSnackbarSeverity] = React.useState<
    "success" | "error"
  >("success");

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
        <PawIcon /> {/* 使用 PawIcon 组件 */}
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
