import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import Icon from '@/components/ui/icon';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

type User = {
  id: number;
  email: string;
  full_name: string;
  role: string;
  referral_code: string;
  balance: string;
  created_at: string;
};

type Transaction = {
  id: number;
  type: string;
  amount: string;
  currency: string;
  status: string;
  wallet_address?: string;
  tx_hash?: string;
  description: string;
  created_at: string;
};

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawWallet, setWithdrawWallet] = useState('');
  const [platformWallet, setPlatformWallet] = useState('');
  const [transactionId, setTransactionId] = useState<number | null>(null);
  const [txHash, setTxHash] = useState('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [processing, setProcessing] = useState(false);
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

  const loadTransactions = async () => {
    const sessionToken = localStorage.getItem('session_token');
    if (!sessionToken) return;

    try {
      const response = await fetch(
        'https://functions.poehali.dev/b640fcbc-6bf9-46c7-bfd2-551107389fb3?action=transactions',
        {
          headers: { 'X-Session-Token': sessionToken },
        }
      );

      const data = await response.json();
      if (response.ok) {
        setTransactions(data.transactions);
      }
    } catch (error) {
      console.error('Failed to load transactions', error);
    }
  };

  const handleDeposit = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      toast({ title: 'Ошибка', description: 'Введите корректную сумму', variant: 'destructive' });
      return;
    }

    setProcessing(true);
    const sessionToken = localStorage.getItem('session_token');

    try {
      const response = await fetch(
        'https://functions.poehali.dev/b640fcbc-6bf9-46c7-bfd2-551107389fb3?action=deposit',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Session-Token': sessionToken || '' },
          body: JSON.stringify({ amount: parseFloat(depositAmount), currency: 'USDT' }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        setPlatformWallet(data.wallet_address);
        setTransactionId(data.transaction_id);
        toast({ title: 'Адрес получен', description: 'Переведите средства на указанный адрес' });
      } else {
        toast({ title: 'Ошибка', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Ошибка', description: 'Не удалось создать заявку', variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirmDeposit = async () => {
    if (!txHash || !transactionId) {
      toast({ title: 'Ошибка', description: 'Введите хеш транзакции', variant: 'destructive' });
      return;
    }

    setProcessing(true);
    const sessionToken = localStorage.getItem('session_token');

    try {
      const response = await fetch(
        'https://functions.poehali.dev/b640fcbc-6bf9-46c7-bfd2-551107389fb3?action=confirm',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Session-Token': sessionToken || '' },
          body: JSON.stringify({ transaction_id: transactionId, tx_hash: txHash }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        toast({ title: 'Успешно', description: 'Баланс пополнен!' });
        setDepositOpen(false);
        setDepositAmount('');
        setPlatformWallet('');
        setTxHash('');
        setTransactionId(null);
        loadTransactions();
        window.location.reload();
      } else {
        toast({ title: 'Ошибка', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Ошибка', description: 'Не удалось подтвердить транзакцию', variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      toast({ title: 'Ошибка', description: 'Введите корректную сумму', variant: 'destructive' });
      return;
    }

    if (!withdrawWallet) {
      toast({ title: 'Ошибка', description: 'Введите адрес кошелька', variant: 'destructive' });
      return;
    }

    setProcessing(true);
    const sessionToken = localStorage.getItem('session_token');

    try {
      const response = await fetch(
        'https://functions.poehali.dev/b640fcbc-6bf9-46c7-bfd2-551107389fb3?action=withdraw',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Session-Token': sessionToken || '' },
          body: JSON.stringify({
            amount: parseFloat(withdrawAmount),
            wallet_address: withdrawWallet,
            currency: 'USDT',
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        toast({ title: 'Успешно', description: data.message });
        setWithdrawOpen(false);
        setWithdrawAmount('');
        setWithdrawWallet('');
        loadTransactions();
        window.location.reload();
      } else {
        toast({ title: 'Ошибка', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Ошибка', description: 'Не удалось создать заявку', variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadTransactions();
    }
  }, [user]);

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
                <Button size="sm" variant="outline" onClick={() => setDepositOpen(true)}>
                  <Icon name="Plus" size={16} className="mr-2" />
                  Пополнить
                </Button>
                <Button size="sm" variant="outline" onClick={() => setWithdrawOpen(true)}>
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
              <Icon name="History" size={20} />
              История транзакций
            </CardTitle>
          </CardHeader>
          <CardContent>
            {transactions.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Тип</TableHead>
                    <TableHead>Сумма</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Дата</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell>
                        {tx.type === 'deposit' ? 'Пополнение' : 'Вывод'}
                      </TableCell>
                      <TableCell>
                        {tx.amount} {tx.currency}
                      </TableCell>
                      <TableCell>
                        <Badge variant={tx.status === 'completed' ? 'default' : 'secondary'}>
                          {tx.status === 'completed' ? 'Завершено' : tx.status === 'processing' ? 'В обработке' : 'Ожидание'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(tx.created_at).toLocaleDateString('ru-RU')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground">История транзакций пуста</p>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Пополнение баланса</DialogTitle>
            <DialogDescription>
              Переведите USDT (TRC-20) на указанный адрес
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {!platformWallet ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="depositAmount">Сумма (USDT)</Label>
                  <Input
                    id="depositAmount"
                    type="number"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    placeholder="100"
                  />
                </div>
                <Button onClick={handleDeposit} disabled={processing} className="w-full">
                  {processing ? 'Создание...' : 'Получить адрес'}
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Адрес для перевода</Label>
                  <div className="flex gap-2">
                    <code className="flex-1 px-3 py-2 bg-muted rounded text-sm break-all">
                      {platformWallet}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(platformWallet);
                        toast({ title: 'Скопировано!', description: 'Адрес скопирован' });
                      }}
                    >
                      <Icon name="Copy" size={16} />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="txHash">Хеш транзакции</Label>
                  <Input
                    id="txHash"
                    value={txHash}
                    onChange={(e) => setTxHash(e.target.value)}
                    placeholder="Вставьте хеш после отправки"
                  />
                </div>
                <Button onClick={handleConfirmDeposit} disabled={processing} className="w-full">
                  {processing ? 'Подтверждение...' : 'Подтвердить пополнение'}
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Вывод средств</DialogTitle>
            <DialogDescription>
              Укажите адрес кошелька и сумму для вывода
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="withdrawAmount">Сумма (USDT)</Label>
              <Input
                id="withdrawAmount"
                type="number"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="100"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="withdrawWallet">Адрес кошелька (TRC-20)</Label>
              <Input
                id="withdrawWallet"
                value={withdrawWallet}
                onChange={(e) => setWithdrawWallet(e.target.value)}
                placeholder="TXyz..."
              />
            </div>
            <Button onClick={handleWithdraw} disabled={processing} className="w-full">
              {processing ? 'Обработка...' : 'Вывести средства'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;