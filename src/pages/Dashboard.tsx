import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import Icon from '@/components/ui/icon';

type User = {
  id: number;
  email: string;
  full_name: string;
  role: string;
  referral_code: string;
  balance: string;
  created_at: string;
};

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkAuth = async () => {
      const sessionToken = localStorage.getItem('session_token');
      
      if (!sessionToken) {
        navigate('/login');
        return;
      }

      try {
        const response = await fetch(
          'https://functions.poehali.dev/2094aa8b-25b9-4d14-81b0-81a24a06bb41?action=me',
          {
            headers: { 'X-Session-Token': sessionToken },
          }
        );

        const data = await response.json();

        if (response.ok) {
          setUser(data.user);
        } else {
          localStorage.removeItem('session_token');
          localStorage.removeItem('user');
          navigate('/login');
        }
      } catch (error) {
        toast({
          title: 'Ошибка',
          description: 'Не удалось проверить сессию',
          variant: 'destructive',
        });
        navigate('/login');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [navigate, toast]);

  const handleLogout = () => {
    localStorage.removeItem('session_token');
    localStorage.removeItem('user');
    toast({
      title: 'Вы вышли',
      description: 'До встречи!',
    });
    navigate('/');
  };

  const copyReferralLink = () => {
    const link = `${window.location.origin}/register?ref=${user?.referral_code}`;
    navigator.clipboard.writeText(link);
    toast({
      title: 'Скопировано!',
      description: 'Реферальная ссылка скопирована в буфер обмена',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Загрузка...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">CryptoPartners</h1>
          <Button variant="outline" onClick={handleLogout}>
            <Icon name="LogOut" size={16} className="mr-2" />
            Выйти
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon name="User" size={20} />
                Профиль
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm">
                <span className="font-medium">Имя:</span> {user?.full_name}
              </p>
              <p className="text-sm">
                <span className="font-medium">Email:</span> {user?.email}
              </p>
              <p className="text-sm">
                <span className="font-medium">Роль:</span> {user?.role}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon name="Wallet" size={20} />
                Баланс
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{user?.balance} ₽</p>
              <div className="mt-4 flex gap-2">
                <Button size="sm" variant="outline">
                  <Icon name="Plus" size={16} className="mr-2" />
                  Пополнить
                </Button>
                <Button size="sm" variant="outline">
                  <Icon name="Minus" size={16} className="mr-2" />
                  Вывести
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon name="Users" size={20} />
                Реферальная программа
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Ваш реферальный код:
              </p>
              <div className="flex gap-2">
                <code className="flex-1 px-3 py-2 bg-muted rounded text-sm">
                  {user?.referral_code}
                </code>
                <Button size="sm" variant="outline" onClick={copyReferralLink}>
                  <Icon name="Copy" size={16} />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon name="ShoppingCart" size={20} />
              Товары
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Список товаров появится здесь</p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Dashboard;
